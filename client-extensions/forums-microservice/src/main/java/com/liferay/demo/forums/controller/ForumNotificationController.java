// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.controller;

import com.liferay.client.extension.util.spring.boot3.BaseRestController;
import com.liferay.demo.forums.service.EmailNotificationService;
import com.liferay.demo.forums.service.SubscriptionService;
import com.liferay.demo.forums.service.Subscriber;
import com.liferay.demo.forums.service.WebNotificationService;

import java.util.List;

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
 *       {@code ForumReply} Object entry is created.  Notifies all users who
 *       subscribed to the parent {@code ForumMessage}.</li>
 *   <li>{@code /object-action/new-message} — triggered when a new root
 *       {@code ForumMessage} Object entry is created (i.e. a new topic).
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
	 * Handles a new ForumReply being created.
	 *
	 * <p>Expected payload fields (in addition to standard Object entry
	 * metadata):</p>
	 * <ul>
	 *   <li>{@code body} — HTML body of the reply</li>
	 *   <li>{@code r_messageReplies_c_forumMessageId} — FK to the parent
	 *       ForumMessage</li>
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

		if (values != null) {
			parentMessageId = values.optLong("r_messageReplies_c_forumMessageId", 0L);
			replyBody = _stripHtml(values.optString("body", ""));
		}

		if (parentMessageId == 0L) {
			_log.warn("onNewReply: missing r_messageReplies_c_forumMessageId in payload");

			return new ResponseEntity<>(json, HttpStatus.OK);
		}

		JSONObject dto = payload.optJSONObject("objectEntryDTOForumReply");
		JSONObject creator = (dto != null) ? dto.optJSONObject("creator") : null;

		String replyAuthor = _resolveAuthorName(creator);

		// Fetch the parent ForumMessage to get the topic title

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

		String url = _constructDisplayPageUrl(payload, dto, jwt.getTokenValue());
		_log.info("Constructed Display Page URL for Reply: " + url);

		_emailNotificationService.sendNewReplyNotification(
			messageTitle, parentMessageId, replyAuthor, replyBody, subscriberEmails, url, jwt.getTokenValue());

		// Send web notifications

		_webNotificationService.sendNotifications(
			subscribers, "New Reply: " + messageTitle,
			replyAuthor + " has replied to the discussion.", url, jwt.getTokenValue());

		return new ResponseEntity<>(json, HttpStatus.OK);
	}

	/**
	 * Handles a new root ForumMessage (topic) being created.
	 *
	 * <p>Expected payload fields:</p>
	 * <ul>
	 *   <li>{@code messageTitle} — topic title</li>
	 *   <li>{@code id} — ForumMessage ID</li>
	 *   <li>{@code r_categoryMessages_c_forumCategoryId} — FK to the parent
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
			categoryId = values.optLong("r_categoryMessages_c_forumCategoryId", 0L);
		}

		JSONObject dto = payload.optJSONObject("objectEntryDTOForumMessage");
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

		List<String> subscriberEmails = subscribers.stream()
			.map(Subscriber::getEmailAddress)
			.toList();

		String url = _constructDisplayPageUrl(payload, dto, jwt.getTokenValue());
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
				"/o/c/forummessages/" + messageId + "?fields=messageTitle",
				authToken);

			return new JSONObject(response).optString("messageTitle", null);
		}
		catch (Exception e) {
			_log.error("Failed to fetch ForumMessage title for id=" + messageId + ": " + e.getMessage());

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

	private String _constructDisplayPageUrl(JSONObject payload, JSONObject dto, String authToken) {
		if (payload == null || dto == null) {
			return "";
		}

		try {
			JSONObject systemProperties = dto.optJSONObject("systemProperties");
			if (systemProperties == null) {
				_log.warn("Cannot construct display page URL; missing systemProperties.");
				return "";
			}

			String siteErc = systemProperties
				.optJSONObject("scope")
				.optString("externalReferenceCode", "");

			long objectDefinitionId = payload.optLong("objectDefinitionId", 0L);
			String entryFriendlyUrl = dto.optString("friendlyUrlPath", "");

			if (siteErc.isBlank() || objectDefinitionId == 0L || entryFriendlyUrl.isBlank()) {
				_log.warn("Cannot construct display page URL; missing properties in dto.");
				return "";
			}

			// Fetch site friendly URL
			String siteResponse = _liferayApiClient.get(
				"/o/headless-admin-site/v1.0/sites/" + siteErc + "?fields=friendlyUrlPath", authToken);
			String siteFriendlyUrl = new JSONObject(siteResponse).optString("friendlyUrlPath", "");

			// Fetch object definition friendly URL separator
			String objDefResponse = _liferayApiClient.get(
				"/o/object-admin/v1.0/object-definitions/" + objectDefinitionId + "?fields=friendlyURLSeparator", authToken);
			String urlSeparator = new JSONObject(objDefResponse).optString("friendlyURLSeparator", "");

			if (siteFriendlyUrl.isBlank() || urlSeparator.isBlank()) {
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
	private WebNotificationService _webNotificationService;

	@Autowired
	private SubscriptionService _subscriptionService;

	private static final Log _log = LogFactory.getLog(ForumNotificationController.class);

}
