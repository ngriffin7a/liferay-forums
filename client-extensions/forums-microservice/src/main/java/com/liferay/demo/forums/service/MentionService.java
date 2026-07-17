// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.service;

import com.liferay.demo.forums.client.LiferayApiClient;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

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
 * mentioned user's screen name (the {@code alternateName} field), e.g.
 * {@code <a class="forums-mention" href="#mention-jane.doe">@Jane Doe</a>}. The
 * href fragment is the reliable channel: CKEditor 5's schema may strip the
 * {@code class}/{@code data-*} attributes when the body is serialized, but the
 * anchor href survives — so handles are parsed from the {@code #mention-{handle}}
 * pattern rather than from a data attribute.</p>
 *
 * <p>The screen name (rather than the numeric user id) is the durable channel
 * because it is a filterable/indexed field: mentions resolve to email addresses
 * with a single site-scoped OData query, and — because that query is scoped to
 * the site — a handle for a non-member simply does not match and is dropped. A
 * crafted body therefore cannot notify or probe users outside the site.</p>
 */
@Service
public class MentionService {

	private static final Logger _log = LoggerFactory.getLogger(MentionService.class);

	/* The composer URL-encodes the screen name into the href fragment, so the
	   captured token runs up to the closing quote (or a tag/whitespace
	   boundary) and is URL-decoded below. Capturing broadly keeps parsing
	   correct for screen names outside the default character set. */
	private static final Pattern _MENTION_PATTERN = Pattern.compile(
		"#mention-([^\"'\\s<>]+)");

	/**
	 * Extracts the distinct screen names mentioned in the given (raw HTML) body.
	 * Insertion order is preserved.
	 *
	 * @param bodyHtml the raw HTML body of the forum message
	 * @return the mentioned screen names, lowercased; never {@code null}
	 */
	public Set<String> extractMentionedScreenNames(String bodyHtml) {
		Set<String> screenNames = new LinkedHashSet<>();

		if ((bodyHtml == null) || bodyHtml.isBlank()) {
			return screenNames;
		}

		Matcher matcher = _MENTION_PATTERN.matcher(bodyHtml);

		while (matcher.find()) {
			String screenName;

			try {
				screenName = URLDecoder.decode(
					matcher.group(1), StandardCharsets.UTF_8);
			}
			catch (IllegalArgumentException illegalArgumentException) {
				// Malformed percent-encoding; skip this token.

				continue;
			}

			if (!screenName.isBlank()) {
				screenNames.add(screenName.toLowerCase());
			}
		}

		return screenNames;
	}

	/**
	 * Resolves mentioned screen names to {@link Subscriber} records (user id +
	 * email address) <em>strictly against the members of the given site</em>.
	 *
	 * <p>Only members of {@code siteId} can be mentioned and notified. A
	 * mentioned screen name that is not a member of the site — for example a
	 * handle injected into the post body via the REST API, since the composer's
	 * site-scoped picker is only a client-side convenience — does not match the
	 * site-scoped query and is dropped. The company-wide user-account endpoint
	 * is deliberately <em>not</em> consulted, so a crafted body cannot notify or
	 * probe users outside the site.</p>
	 *
	 * @param screenNames the mentioned screen names (lowercased)
	 * @param siteId      the group id of the site the post belongs to; when
	 *                    {@code <= 0} no mentions are resolved (fail closed)
	 * @param authToken   OAuth2 bearer token (JWT) for the API call
	 * @return the resolvable, site-member mentioned users; never {@code null}
	 */
	public List<Subscriber> resolveMentions(
		Set<String> screenNames, long siteId, String authToken) {

		List<Subscriber> mentioned = new ArrayList<>();

		if ((screenNames == null) || screenNames.isEmpty()) {
			return mentioned;
		}

		if (siteId <= 0) {
			_log.warn(
				"Refusing to resolve {} mention(s) without a site scope",
				screenNames.size());

			return mentioned;
		}

		// A single site-scoped query filtered on the (indexed, filterable)
		// alternateName field. Non-members do not appear in this site listing,
		// so they cannot be resolved even if their handle is spelled correctly.

		String filter = screenNames.stream()
			.map(screenName -> "alternateName eq '" + _escape(screenName) + "'")
			.collect(Collectors.joining(" or "));

		try {
			String response = _liferayApiClient.get(
				"/o/headless-admin-user/v1.0/sites/" + siteId +
					"/user-accounts?fields=id,emailAddress&pageSize=" +
						screenNames.size() + "&filter=" +
							URLEncoder.encode(filter, StandardCharsets.UTF_8),
				authToken);

			JSONArray items = new JSONObject(response).optJSONArray("items");

			if (items != null) {
				for (int i = 0; i < items.length(); i++) {
					JSONObject item = items.optJSONObject(i);

					if (item == null) {
						continue;
					}

					long userId = item.optLong("id", 0L);
					String emailAddress = item.optString("emailAddress", "");

					if ((userId > 0L) && !emailAddress.isBlank()) {
						mentioned.add(new Subscriber(userId, emailAddress));
					}
				}
			}
		}
		catch (Exception exception) {
			_log.warn(
				"Failed to resolve mentions for siteId={}: {}", siteId,
				exception.getMessage());

			return mentioned;
		}

		_log.debug(
			"Resolved {} of {} mentioned screen name(s) within siteId={}",
			mentioned.size(), screenNames.size(), siteId);

		return mentioned;
	}

	/* Double single quotes per OData string escaping. */
	private String _escape(String value) {
		return value.replace("'", "''");
	}

	@Autowired
	private LiferayApiClient _liferayApiClient;

}
