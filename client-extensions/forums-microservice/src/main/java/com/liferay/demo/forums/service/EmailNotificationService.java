// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Sends plain-text email notifications to forum subscribers.
 *
 * @author Neil Griffin
 */
@Service
public class EmailNotificationService {

	private static final Logger _log = LoggerFactory.getLogger(EmailNotificationService.class);

	/**
	 * Sends a "new reply" notification to all subscribers of a forum message.
	 *
	 * @param messageTitle    title of the parent forum message (topic)
	 * @param messageId       ID of the parent forum message
	 * @param replyAuthor     display name of the user who posted the reply
	 * @param replyBody       plain-text body of the reply (HTML stripped by caller)
	 * @param subscriberEmails list of email addresses to notify
	 * @param messageUrl       the display page url
	 * @param authToken        OAuth2 bearer token
	 */
	public void sendNewReplyNotification(
		String messageTitle, long messageId, String replyAuthor,
		String replyBody, List<String> subscriberEmails, String messageUrl, String authToken) {

		if (subscriberEmails.isEmpty()) {
			return;
		}

		String subject = "Re: " + messageTitle;
		String fullUrl = _siteBaseUrl + messageUrl;

		String body = "Hello,\n\n"
			+ replyAuthor + " has posted a new reply to the topic you are subscribed to:\n\n"
			+ "  \"" + messageTitle + "\"\n\n"
			+ _truncate(replyBody, 300) + "\n\n"
			+ "View the full discussion:\n" + fullUrl + "\n\n"
			+ "---\n"
			+ "You are receiving this email because you subscribed to this forum topic.\n"
			+ "To unsubscribe, visit the topic page and click Unsubscribe.";

		_sendToAll(subject, body, subscriberEmails, authToken);
	}

	/**
	 * Sends a "new topic" notification to all subscribers of a forum category.
	 *
	 * @param categoryName     name of the forum category
	 * @param messageTitle     title of the new topic
	 * @param messageId        ID of the new forum message
	 * @param messageAuthor    display name of the user who created the topic
	 * @param subscriberEmails list of email addresses to notify
	 * @param authToken        OAuth2 bearer token
	 */
	public void sendNewTopicNotification(
		String categoryName, String messageTitle, long messageId,
		String messageAuthor, List<String> subscriberEmails, String messageUrl, String authToken) {

		if (subscriberEmails.isEmpty()) {
			return;
		}

		String subject = "[" + categoryName + "] New topic: " + messageTitle;
		String fullUrl = _siteBaseUrl + messageUrl;

		String body = "Hello,\n\n"
			+ messageAuthor + " has posted a new topic in " + categoryName + ":\n\n"
			+ "  \"" + messageTitle + "\"\n\n"
			+ "View the topic:\n" + fullUrl + "\n\n"
			+ "---\n"
			+ "You are receiving this email because you subscribed to this forum category.\n"
			+ "To unsubscribe, visit the category page and click Unsubscribe.";

		_sendToAll(subject, body, subscriberEmails, authToken);
	}

	/**
	 * Sends a "you were mentioned" notification to users mentioned in a post.
	 *
	 * @param messageTitle     title of the topic the post belongs to
	 * @param author           display name of the user who wrote the post
	 * @param bodyPreview       plain-text body of the post (HTML stripped by caller)
	 * @param subscriberEmails list of mentioned users' email addresses
	 * @param messageUrl       the display page url
	 * @param authToken        OAuth2 bearer token
	 */
	public void sendMentionNotification(
		String messageTitle, String author, String bodyPreview,
		List<String> subscriberEmails, String messageUrl, String authToken) {

		if (subscriberEmails.isEmpty()) {
			return;
		}

		String subject = author + " mentioned you in: " + messageTitle;
		String fullUrl = _siteBaseUrl + messageUrl;

		String body = "Hello,\n\n"
			+ author + " mentioned you in the topic:\n\n"
			+ "  \"" + messageTitle + "\"\n\n"
			+ _truncate(bodyPreview, 300) + "\n\n"
			+ "View the discussion:\n" + fullUrl + "\n\n"
			+ "---\n"
			+ "You are receiving this email because someone mentioned you in a forum post.";

		_sendToAll(subject, body, subscriberEmails, authToken);
	}

	private void _sendToAll(String subject, String body, List<String> recipients, String authToken) {
		int successCount = 0;

		for (String recipient : recipients) {
			try {
				org.json.JSONObject payload = new org.json.JSONObject();
				payload.put("subject", subject);
				payload.put("body", body);
				payload.put("type", "email");

				org.json.JSONArray recipientsArray = new org.json.JSONArray();
				org.json.JSONObject recipientObj = new org.json.JSONObject();
				recipientObj.put("from", _fromAddress);
				recipientObj.put("fromName", _fromName);
				recipientObj.put("to", recipient);
				recipientObj.put("toType", "email");
				recipientsArray.put(recipientObj);

				payload.put("recipients", recipientsArray);

				_liferayApiClient.post("/o/notification/v1.0/notification-queue-entries", authToken, payload.toString());

				successCount++;

				_log.debug("Sent notification to {}", recipient);
			}
			catch (Exception e) {
				_log.error("Failed to send notification to {}: {}", recipient, e.getMessage());
			}
		}

		_log.info(
			"Forum notification sent to {}/{} subscriber(s): subject=\"{}\"",
			successCount, recipients.size(), subject);
	}

	private String _truncate(String text, int maxLength) {
		if ((text == null) || (text.length() <= maxLength)) {
			return text != null ? text : "";
		}

		return text.substring(0, maxLength) + "...";
	}

	@Autowired
	private com.liferay.demo.forums.client.LiferayApiClient _liferayApiClient;

	@Value("${forums.email.from.address:forums-noreply@example.xyz}")
	private String _fromAddress;

	@Value("${forums.email.from.name:Community Forums}")
	private String _fromName;

	@Value("${forums.site.base.url:https://www.example.xyz}")
	private String _siteBaseUrl;

}
