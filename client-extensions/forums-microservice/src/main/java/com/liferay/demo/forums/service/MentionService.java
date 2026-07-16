// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.service;

import com.liferay.demo.forums.client.LiferayApiClient;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
	 * email address) by calling the headless user API once per id. Ids that
	 * cannot be resolved (deleted user, missing permission) are skipped.
	 *
	 * @param userIds   the mentioned user ids
	 * @param authToken OAuth2 bearer token (JWT) for the API call
	 * @return the resolvable mentioned users; never {@code null}
	 */
	public List<Subscriber> resolveMentions(Set<Long> userIds, String authToken) {
		List<Subscriber> mentioned = new ArrayList<>();

		if ((userIds == null) || userIds.isEmpty()) {
			return mentioned;
		}

		for (long userId : userIds) {
			try {
				String response = _liferayApiClient.get(
					"/o/headless-admin-user/v1.0/user-accounts/" + userId +
						"?fields=emailAddress",
					authToken);

				String emailAddress = new JSONObject(response).optString(
					"emailAddress", "");

				if (!emailAddress.isBlank()) {
					mentioned.add(new Subscriber(userId, emailAddress));
				}
			}
			catch (Exception exception) {
				_log.warn(
					"Could not resolve mentioned userId={}: {}", userId,
					exception.getMessage());
			}
		}

		_log.debug("Resolved {} of {} mentioned user(s)", mentioned.size(), userIds.size());

		return mentioned;
	}

	@Autowired
	private LiferayApiClient _liferayApiClient;

}
