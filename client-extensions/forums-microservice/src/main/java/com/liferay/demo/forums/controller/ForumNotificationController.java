// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.controller;

import com.liferay.client.extension.util.spring.boot3.BaseRestController;
import com.liferay.demo.forums.service.EmailNotificationService;
import com.liferay.demo.forums.service.SubscriptionService;
import com.liferay.demo.forums.service.Subscriber;
import com.liferay.demo.forums.service.MentionService;
import com.liferay.demo.forums.service.WebNotificationService;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

import org.json.JSONObject;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Object Action Client Extension handlers for forum email notifications.
 *
 * <p>Two endpoints are registered in {@code client-extension.yaml}:</p>
 * <ul>
 *   <li>{@code /object-action/new-reply} — triggered when a
 *       {@code ForumMessage} Object entry is created.  Notifies all users who
 *       subscribed to the parent {@code ForumThread}.</li>
 *   <li>{@code /object-action/new-message} — triggered when a new root
 *       {@code ForumThread} Object entry is created (i.e. a new topic).
 *       Notifies all users who subscribed to the parent
 *       {@code ForumCategory}.</li>
 * </ul>
 *
 * <p>Liferay invokes these endpoints with a signed JWT (verified by the
 * Spring Boot OAuth2 resource server) and a JSON body containing the full
 * Object entry fields.</p>
 *
 * @author Neil Griffin
 */
@RestController
public class ForumNotificationController extends BaseRestController {

	/**
	 * Handles a new ForumMessage being created.
	 *
	 * <p>Expected payload fields (in addition to standard Object entry
	 * metadata):</p>
	 * <ul>
	 *   <li>{@code body} — HTML body of the reply</li>
	 *   <li>{@code r_threadMessages_c_forumThreadId} — FK to the parent
	 *       ForumThread</li>
	 *   <li>{@code creator.name} / {@code creator.givenName} — reply author</li>
	 * </ul>
	 */
	@PostMapping("/object-action/new-reply")
	public ResponseEntity<String> onNewReply(
			@AuthenticationPrincipal Jwt jwt, @RequestBody String json)
		throws Exception {

		log(jwt, _log, json);

		JSONObject payload = new JSONObject(json);

		// Parse the reply payload

		JSONObject objectEntry = payload.optJSONObject("objectEntry");
		JSONObject values = (objectEntry != null) ? objectEntry.optJSONObject("values") : null;

		long parentMessageId = 0L;
		String replyBody = "";
		String rawReplyBody = "";

		if (values != null) {
			parentMessageId = values.optLong("r_threadMessages_c_forumThreadId", 0L);
			rawReplyBody = values.optString("body", "");
			replyBody = _stripHtml(rawReplyBody);
		}

		if (parentMessageId == 0L) {
			_log.warn("onNewReply: missing r_threadMessages_c_forumThreadId in payload");

			return new ResponseEntity<>(json, HttpStatus.OK);
		}

		JSONObject dto = payload.optJSONObject("objectEntryDTOForumMessage");
		JSONObject creator = (dto != null) ? dto.optJSONObject("creator") : null;

		String replyAuthor = _resolveAuthorName(creator);

		// Fetch the parent ForumThread to get the topic title

		String messageTitle = _fetchMessageTitle(parentMessageId, jwt.getTokenValue());

		if (messageTitle == null) {
			_log.warn("onNewReply: could not fetch title for messageId=" + parentMessageId);

			messageTitle = "Forum Discussion";
		}

		// Notify subscribers

		List<Subscriber> subscribers = _subscriptionService.getSubscribers(
			parentMessageId, jwt.getTokenValue());

		// Exclude the reply author from notifications

		String authorEmail = _resolveCreatorEmail(creator);

		subscribers.removeIf(s -> s.getEmailAddress().equalsIgnoreCase(authorEmail));

		List<String> subscriberEmails = subscribers.stream()
			.map(Subscriber::getEmailAddress)
			.toList();

		// Parsing the body for @mentions is a cheap local regex (no network),
		// so do it up front: if there are neither subscribers nor mentions to
		// notify, skip the site lookup and URL construction entirely.

		Set<String> mentionedScreenNames = _extractCappedMentions(rawReplyBody);

		if (subscribers.isEmpty() && mentionedScreenNames.isEmpty()) {
			return new ResponseEntity<>(json, HttpStatus.OK);
		}

		// Fetch the site once; both the display page URL and the mention site
		// scope read from it, so a reply makes a single site lookup.

		JSONObject site = _fetchSite(dto, jwt.getTokenValue());

		String url = _constructDisplayPageUrl(payload, dto, site, jwt.getTokenValue());
		_log.info("Constructed Display Page URL for Reply: " + url);

		_emailNotificationService.sendNewReplyNotification(
			messageTitle, parentMessageId, replyAuthor, replyBody, subscriberEmails, url, jwt.getTokenValue());

		// Send web notifications

		_webNotificationService.sendNotifications(
			subscribers, "New Reply: " + messageTitle,
			replyAuthor + " has replied to the discussion.", url, jwt.getTokenValue());

		// Notify any users @mentioned in the post body. This also covers a new
		// topic's opening post, since its root ForumMessage triggers this same
		// handler. Subscribers already notified above are excluded to avoid a
		// duplicate ping. Mentions are resolved only against members of the
		// site the post belongs to, so a handle injected into the body cannot
		// notify users outside the site.

		long siteId = _resolveSiteId(dto, site);

		_notifyMentions(
			mentionedScreenNames, messageTitle, replyAuthor, replyBody, url,
			subscribers, authorEmail, siteId, jwt.getTokenValue());

		return new ResponseEntity<>(json, HttpStatus.OK);
	}

	/**
	 * Extracts the @mention screen names from a post body, capped at
	 * {@code _MAX_MENTIONS}. Capping bounds the notification fan-out (a body
	 * crafted with many handles cannot be used to spam) and keeps the
	 * site-scoped resolution query's "or" clauses within a sane URL length.
	 * Insertion order is preserved, so the first mentions in the body win.
	 */
	private Set<String> _extractCappedMentions(String rawBody) {
		Set<String> mentionedScreenNames =
			_mentionService.extractMentionedScreenNames(rawBody);

		if (mentionedScreenNames.size() > _MAX_MENTIONS) {
			_log.warn(
				"Post mentions " + mentionedScreenNames.size() +
					" users; honoring only the first " + _MAX_MENTIONS);

			mentionedScreenNames = mentionedScreenNames.stream()
				.limit(_MAX_MENTIONS)
				.collect(Collectors.toCollection(LinkedHashSet::new));
		}

		return mentionedScreenNames;
	}

	/**
	 * Notifies users @mentioned in a post body, by email and in-portal
	 * notification, excluding the author and anyone in
	 * {@code alreadyNotified} (e.g. topic subscribers already pinged).
	 */
	private void _notifyMentions(
		Set<String> mentionedScreenNames, String messageTitle, String author,
		String bodyPreview, String url, List<Subscriber> alreadyNotified,
		String authorEmail, long siteId, String authToken) {

		if (mentionedScreenNames.isEmpty()) {
			return;
		}

		List<Subscriber> mentioned = _mentionService.resolveMentions(
			mentionedScreenNames, siteId, authToken);

		Set<Long> excludeUserIds = new HashSet<>();

		for (Subscriber subscriber : alreadyNotified) {
			excludeUserIds.add(subscriber.getUserId());
		}

		List<Subscriber> recipients = new ArrayList<>();

		for (Subscriber subscriber : mentioned) {
			if (excludeUserIds.contains(subscriber.getUserId())) {
				continue;
			}

			if ((authorEmail != null) &&
				subscriber.getEmailAddress().equalsIgnoreCase(authorEmail)) {

				continue;
			}

			recipients.add(subscriber);
		}

		if (recipients.isEmpty()) {
			return;
		}

		List<String> recipientEmails = recipients.stream()
			.map(Subscriber::getEmailAddress)
			.toList();

		_emailNotificationService.sendMentionNotification(
			messageTitle, author, bodyPreview, recipientEmails, url, authToken);

		_webNotificationService.sendNotifications(
			recipients, author + " mentioned you",
			author + " mentioned you in: " + messageTitle, url, authToken);
	}

	/**
	 * Handles a new root ForumThread (topic) being created.
	 *
	 * <p>Expected payload fields:</p>
	 * <ul>
	 *   <li>{@code messageTitle} — topic title</li>
	 *   <li>{@code id} — ForumThread ID</li>
	 *   <li>{@code r_categoryThreads_c_forumCategoryId} — FK to the parent
	 *       ForumCategory</li>
	 *   <li>{@code creator.name} / {@code creator.givenName} — topic author</li>
	 * </ul>
	 */
	@PostMapping("/object-action/new-message")
	public ResponseEntity<String> onNewMessage(
			@AuthenticationPrincipal Jwt jwt, @RequestBody String json)
		throws Exception {

		log(jwt, _log, json);

		JSONObject payload = new JSONObject(json);

		JSONObject objectEntry = payload.optJSONObject("objectEntry");
		JSONObject values = (objectEntry != null) ? objectEntry.optJSONObject("values") : null;

		long messageId = payload.optLong("id", 0L);
		String messageTitle = "Forum Discussion";
		long categoryId = 0L;

		if (values != null) {
			messageTitle = values.optString("messageTitle", "Forum Discussion");
			categoryId = values.optLong("r_categoryThreads_c_forumCategoryId", 0L);
		}

		JSONObject dto = payload.optJSONObject("objectEntryDTOForumThread");
		JSONObject creator = (dto != null) ? dto.optJSONObject("creator") : null;

		String author = _resolveAuthorName(creator);

		if (categoryId == 0L) {
			_log.debug("onNewMessage: no categoryId for messageId=" + messageId + "; skipping category subscriber notification");

			return new ResponseEntity<>(json, HttpStatus.OK);
		}

		// Category-level subscriptions use the category's ID as the content key.
		// The c_forumsubscription object must include entries for category
		// subscriptions as well as message-level subscriptions.

		List<Subscriber> subscribers = _subscriptionService.getSubscribers(
			categoryId, jwt.getTokenValue());

		String authorEmail = _resolveCreatorEmail(creator);

		subscribers.removeIf(s -> s.getEmailAddress().equalsIgnoreCase(authorEmail));

		if (subscribers.isEmpty()) {
			return new ResponseEntity<>(json, HttpStatus.OK);
		}

		List<String> subscriberEmails = subscribers.stream()
			.map(Subscriber::getEmailAddress)
			.toList();

		JSONObject site = _fetchSite(dto, jwt.getTokenValue());

		String url = _constructDisplayPageUrl(payload, dto, site, jwt.getTokenValue());
		_log.info("Constructed Display Page URL for Topic: " + url);

		_emailNotificationService.sendNewTopicNotification(
			"Forum Category", messageTitle, messageId, author, subscriberEmails, url, jwt.getTokenValue());

		// Send web notifications

		_webNotificationService.sendNotifications(
			subscribers, "New Topic: " + messageTitle,
			author + " has started a new discussion.", url, jwt.getTokenValue());

		return new ResponseEntity<>(json, HttpStatus.OK);
	}

	private String _fetchMessageTitle(long messageId, String authToken) {
		try {
			String response = _liferayApiClient.get(
				"/o/c/forumthreads/" + messageId + "?fields=messageTitle",
				authToken);

			return new JSONObject(response).optString("messageTitle", null);
		}
		catch (Exception e) {
			_log.error("Failed to fetch ForumThread title for id=" + messageId + ": " + e.getMessage());

			return null;
		}
	}

	private String _resolveAuthorName(JSONObject creator) {
		if (creator != null) {
			String given = creator.optString("givenName", "");
			String family = creator.optString("familyName", "");

			if (!family.isBlank() && !"User".equals(family)) {
				return (given + " " + family).trim();
			}

			if (!given.isBlank()) {
				return given;
			}

			String name = creator.optString("name", "");

			if (!name.isBlank()) {
				return name;
			}
		}

		return "A community member";
	}

	private String _resolveCreatorEmail(JSONObject creator) {
		if (creator != null) {
			return creator.optString("email", "").trim().toLowerCase();
		}

		return "";
	}

	private String _stripHtml(String html) {
		if ((html == null) || html.isBlank()) {
			return "";
		}

		return html.replaceAll("<[^>]+>", " ").replaceAll("\\s{2,}", " ").trim();
	}

	/**
	 * Fetches the entry's site once (id + friendly URL path) so the display
	 * page URL and the mention site scope can share a single lookup. Returns
	 * {@code null} when the scope's external reference code is missing or the
	 * site cannot be fetched.
	 */
	private JSONObject _fetchSite(JSONObject dto, String authToken) {
		if (dto == null) {
			return null;
		}

		JSONObject systemProperties = dto.optJSONObject("systemProperties");
		JSONObject scope = (systemProperties != null) ?
			systemProperties.optJSONObject("scope") : null;

		if (scope == null) {
			return null;
		}

		String siteErc = scope.optString("externalReferenceCode", "");

		if (siteErc.isBlank()) {
			return null;
		}

		try {
			String siteResponse = _liferayApiClient.get(
				"/o/headless-admin-site/v1.0/sites/" + siteErc +
					"?fields=id,friendlyUrlPath",
				authToken);

			return new JSONObject(siteResponse);
		}
		catch (Exception exception) {
			_log.warn(
				"Could not fetch site for ERC " + siteErc + ": " +
					exception.getMessage());

			return null;
		}
	}

	/**
	 * Resolves the numeric group id of the site a post belongs to. Prefers a
	 * numeric scope id carried in the payload, otherwise reads it from the
	 * already-fetched {@code site} (see {@link #_fetchSite}), so no additional
	 * REST call is made. Returns {@code 0} when the site cannot be determined,
	 * so mention resolution fails closed.
	 */
	private long _resolveSiteId(JSONObject dto, JSONObject site) {
		if (dto != null) {
			JSONObject systemProperties = dto.optJSONObject("systemProperties");
			JSONObject scope = (systemProperties != null) ?
				systemProperties.optJSONObject("scope") : null;

			if (scope != null) {
				long scopeId = scope.optLong("id", 0L);

				if (scopeId > 0L) {
					return scopeId;
				}
			}
		}

		return (site != null) ? site.optLong("id", 0L) : 0L;
	}

	private String _constructDisplayPageUrl(
		JSONObject payload, JSONObject dto, JSONObject site, String authToken) {

		if (payload == null || dto == null) {
			return "";
		}

		try {
			long objectDefinitionId = payload.optLong("objectDefinitionId", 0L);
			String entryFriendlyUrl = dto.optString("friendlyUrlPath", "");
			String siteFriendlyUrl = (site != null) ?
				site.optString("friendlyUrlPath", "") : "";

			if (siteFriendlyUrl.isBlank() || objectDefinitionId == 0L || entryFriendlyUrl.isBlank()) {
				_log.warn("Cannot construct display page URL; missing properties in dto or site.");
				return "";
			}

			// Fetch object definition friendly URL separator
			String objDefResponse = _liferayApiClient.get(
				"/o/object-admin/v1.0/object-definitions/" + objectDefinitionId + "?fields=friendlyURLSeparator", authToken);
			String urlSeparator = new JSONObject(objDefResponse).optString("friendlyURLSeparator", "");

			if (urlSeparator.isBlank()) {
				return "";
			}

			return "/web" + siteFriendlyUrl + "/" + urlSeparator + "/" + entryFriendlyUrl;
		}
		catch (Exception e) {
			_log.error("Failed to construct display page URL: " + e.getMessage());
			return "";
		}
	}

	@Autowired
	private com.liferay.demo.forums.client.LiferayApiClient _liferayApiClient;

	@Autowired
	private EmailNotificationService _emailNotificationService;

	@Autowired
	private MentionService _mentionService;

	@Autowired
	private WebNotificationService _webNotificationService;

	@Autowired
	private SubscriptionService _subscriptionService;

	private static final int _MAX_MENTIONS = 25;

	private static final Log _log = LogFactory.getLog(ForumNotificationController.class);

}
