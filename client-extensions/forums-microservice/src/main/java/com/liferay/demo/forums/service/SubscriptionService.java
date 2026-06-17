// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.service;

import com.liferay.demo.forums.client.LiferayApiClient;

import java.util.ArrayList;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONObject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * Retrieves the list of subscribers for a given ForumMessage entry.
 *
 * <h3>How subscriptions are stored</h3>
 * <p>The forum fragments call Liferay's built-in Object subscription HATEOAS
 * actions ({@code /o/c/forummessages/{id}/subscribe} and
 * {@code .../unsubscribe}). Liferay stores these in its internal
 * {@code Subscription} table.</p>
 *
 * <h3>Query strategy</h3>
 * <p>This service queries the custom REST Builder OSGi module
 * ({@code forum-subscriptions}) deployed to Liferay, which exposes an admin
 * endpoint to list all subscribers for a given message ID by delegating to
 * the internal {@code SubscriptionLocalService}.</p>
 *
 * @author Neil Griffin
 */
@Service
public class SubscriptionService {

	private static final Logger _log = LoggerFactory.getLogger(SubscriptionService.class);

	/**
	 * Returns the email addresses of all users subscribed to the given
	 * ForumMessage entry.
	 *
	 * @param messageId  the ID of the ForumMessage whose subscribers to fetch
	 * @param authToken  OAuth2 bearer token (JWT) for the API call;
	 *                   falls back to configured Basic Auth credentials
	 * @return list of subscriber email addresses; never {@code null}
	 */
	public List<Subscriber> getSubscribers(long messageId, String authToken) {
		List<Subscriber> subscribers = new ArrayList<>();

		int page = 1;

		while (true) {
			String path = "/o/forum-subscriptions/v1.0/messages/" + messageId + "/subscribers?page=" + page;

			String response;

			try {
				response = _liferayApiClient.get(path, authToken);
			}
			catch (WebClientResponseException e) {
				_log.error(
					"Failed to fetch ForumSubscriptions for messageId={}: {} {}",
					messageId, e.getStatusCode(), e.getResponseBodyAsString());

				break;
			}
			catch (Exception e) {
				_log.error("Failed to fetch ForumSubscriptions for messageId={}: {}", messageId, e.getMessage(), e);

				break;
			}

			JSONObject json = new JSONObject(response);
			JSONArray items = json.optJSONArray("items");

			if ((items == null) || items.isEmpty()) {
				break;
			}

			for (int i = 0; i < items.length(); i++) {
				JSONObject item = items.getJSONObject(i);
				String email = item.optString("emailAddress", "").trim();
				long userId = item.optLong("userId", 0L);

				if (!email.isEmpty() && (userId > 0)) {
					subscribers.add(new Subscriber(userId, email));
				}
			}

			long lastPage = json.optLong("lastPage", 1);

			if (page >= lastPage) {
				break;
			}

			page++;
		}

		_log.debug("Found {} subscriber(s) for messageId={}", subscribers.size(), messageId);

		return subscribers;
	}

	@Autowired
	private LiferayApiClient _liferayApiClient;

}
