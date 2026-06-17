// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.service;

import com.liferay.demo.forums.client.LiferayApiClient;

import java.util.List;

import org.json.JSONObject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Dispatches web (in-portal) notifications via the custom forum-subscriptions
 * REST API module.
 */
@Service
public class WebNotificationService {

	private static final Logger _log = LoggerFactory.getLogger(WebNotificationService.class);

	/**
	 * Sends a web notification to all given subscribers.
	 *
	 * @param subscribers  list of subscribers to notify
	 * @param subject      the title of the notification
	 * @param body         the HTML or text body of the notification
	 * @param url          the fully constructed URL to navigate to when clicked
	 * @param authToken    OAuth2 bearer token (JWT) for the API call
	 */
	public void sendNotifications(
			List<Subscriber> subscribers, String subject, String body, String url,
			String authToken) {

		if (subscribers == null || subscribers.isEmpty()) {
			return;
		}

		_log.info("Sending web notifications to {} subscribers for '{}'", subscribers.size(), subject);

		try {
			org.json.JSONArray userIds = new org.json.JSONArray();
			for (Subscriber subscriber : subscribers) {
				userIds.put(subscriber.getUserId());
			}

			JSONObject payload = new JSONObject();
			payload.put("userIds", userIds);
			payload.put("subject", subject);
			payload.put("body", body);
			payload.put("url", url);

			_liferayApiClient.post(_webNotificationsEndpoint, authToken, payload.toString());

			_log.debug("Successfully sent batched web notifications");
		}
		catch (Exception e) {
			_log.error("Failed to send batched web notifications: {}", e.getMessage());
		}
	}

	@Autowired
	private LiferayApiClient _liferayApiClient;

	@Value("${liferay.forums.web.notifications.endpoint:/o/forum-subscriptions/v1.0/web-notifications}")
	private String _webNotificationsEndpoint;

}
