// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.service;

import com.liferay.demo.forums.client.LiferayApiClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.json.JSONArray;
import org.json.JSONObject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Resolves user mentions embedded in a forum post body.
 *
 * <h3>How mentions are stored</h3>
 * <p>The message composer inserts a mention as an anchor whose href carries the
 * mentioned user id, e.g.
 * {@code <a class="forums-mention" href="#mention-12345">@Jane Doe</a>}. The
 * href fragment is the reliable channel: CKEditor 5's schema may strip the
 * {@code class}/{@code data-*} attributes when the body is serialized, but the
 * anchor href survives — so ids are parsed from the {@code #mention-{id}}
 * pattern rather than from a data attribute.</p>
 *
 * <p>Given a body, this service extracts the distinct mentioned user ids and
 * resolves each to an email address via the headless user API, returning
 * {@link Subscriber} records the notification services already understand.</p>
 */
@Service
public class MentionService {

	private static final Logger _log = LoggerFactory.getLogger(MentionService.class);

	private static final Pattern _MENTION_PATTERN = Pattern.compile(
		"#mention-(\\d+)");

	/**
	 * Extracts the distinct user ids mentioned in the given (raw HTML) body.
	 * Insertion order is preserved.
	 *
	 * @param bodyHtml the raw HTML body of the forum message
	 * @return the mentioned user ids; never {@code null}
	 */
	public Set<Long> extractMentionedUserIds(String bodyHtml) {
		Set<Long> userIds = new LinkedHashSet<>();

		if ((bodyHtml == null) || bodyHtml.isBlank()) {
			return userIds;
		}

		Matcher matcher = _MENTION_PATTERN.matcher(bodyHtml);

		while (matcher.find()) {
			try {
				userIds.add(Long.parseLong(matcher.group(1)));
			}
			catch (NumberFormatException numberFormatException) {
				// Ignore malformed ids
			}
		}

		return userIds;
	}

	/**
	 * Resolves mentioned user ids to {@link Subscriber} records (user id +
	 * email address) <em>strictly against the members of the given site</em>.
	 *
	 * <p>Only members of {@code siteId} can be mentioned and notified. A
	 * mentioned id that is not a member of the site — for example an arbitrary
	 * id injected into the post body via the REST API, since the composer's
	 * site-scoped picker is only a client-side convenience — is silently
	 * dropped. The company-wide {@code /user-accounts/{id}} endpoint is
	 * deliberately <em>not</em> consulted, so a crafted body cannot notify or
	 * probe users outside the site.</p>
	 *
	 * @param userIds   the mentioned user ids
	 * @param siteId    the group id of the site the post belongs to; when
	 *                  {@code <= 0} no mentions are resolved (fail closed)
	 * @param authToken OAuth2 bearer token (JWT) for the API call
	 * @return the resolvable, site-member mentioned users; never {@code null}
	 */
	public List<Subscriber> resolveMentions(
		Set<Long> userIds, long siteId, String authToken) {

		List<Subscriber> mentioned = new ArrayList<>();

		if ((userIds == null) || userIds.isEmpty()) {
			return mentioned;
		}

		if (siteId <= 0) {
			_log.warn(
				"Refusing to resolve {} mention(s) without a site scope",
				userIds.size());

			return mentioned;
		}

		Map<Long, String> siteMemberEmails = _fetchSiteMemberEmails(
			userIds, siteId, authToken);

		for (long userId : userIds) {
			String emailAddress = siteMemberEmails.get(userId);

			if ((emailAddress != null) && !emailAddress.isBlank()) {
				mentioned.add(new Subscriber(userId, emailAddress));
			}
			else {
				_log.debug(
					"Dropping mention of userId={}; not a member of siteId={}",
					userId, siteId);
			}
		}

		_log.debug(
			"Resolved {} of {} mentioned user(s) within siteId={}",
			mentioned.size(), userIds.size(), siteId);

		return mentioned;
	}

	/**
	 * Pages the site-scoped user-account listing, collecting the email address
	 * of each wanted id that is actually a member of the site. Paging stops as
	 * soon as every wanted id has been found (so the common case of a handful
	 * of mentions on a small site costs a single request). {@code id} is not a
	 * filterable field on the user-accounts entity, so the ids cannot be pushed
	 * into an OData filter — the listing is scanned and matched in memory.
	 */
	private Map<Long, String> _fetchSiteMemberEmails(
		Set<Long> wantedUserIds, long siteId, String authToken) {

		Map<Long, String> emailsByUserId = new HashMap<>();
		Set<Long> remaining = new HashSet<>(wantedUserIds);

		boolean lastPageReached = false;
		int page = 1;

		while (!remaining.isEmpty() && (page <= _MAX_PAGES)) {
			String response;

			try {
				response = _liferayApiClient.get(
					"/o/headless-admin-user/v1.0/sites/" + siteId +
						"/user-accounts?fields=id,emailAddress&page=" + page +
							"&pageSize=" + _PAGE_SIZE,
					authToken);
			}
			catch (Exception exception) {
				_log.warn(
					"Failed to page members of siteId={} (page {}): {}",
					siteId, page, exception.getMessage());

				break;
			}

			JSONArray items = new JSONObject(response).optJSONArray("items");

			if ((items == null) || items.isEmpty()) {
				lastPageReached = true;

				break;
			}

			for (int i = 0; i < items.length(); i++) {
				JSONObject item = items.optJSONObject(i);

				if (item == null) {
					continue;
				}

				long userId = item.optLong("id", 0L);

				if (remaining.remove(userId)) {
					emailsByUserId.put(
						userId, item.optString("emailAddress", ""));
				}
			}

			if (items.length() < _PAGE_SIZE) {
				lastPageReached = true;

				break;
			}

			page++;
		}

		// Any id still remaining after a full scan is simply not a site member
		// (the expected outcome for an injected id). Only warn when the scan was
		// cut short by the page cap, since a genuine member beyond the cap on a
		// very large site could then have been dropped.

		if (!remaining.isEmpty() && !lastPageReached) {
			_log.warn(
				"Reached the {}-member scan cap for siteId={} with {} " +
					"mention(s) unresolved; a member beyond the cap may have " +
						"been dropped",
				_MAX_PAGES * _PAGE_SIZE, siteId, remaining.size());
		}

		return emailsByUserId;
	}

	@Autowired
	private LiferayApiClient _liferayApiClient;

	private static final int _MAX_PAGES = 50;

	private static final int _PAGE_SIZE = 100;

}
