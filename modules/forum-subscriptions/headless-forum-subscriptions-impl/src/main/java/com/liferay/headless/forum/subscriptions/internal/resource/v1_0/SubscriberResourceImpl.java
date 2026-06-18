package com.liferay.headless.forum.subscriptions.internal.resource.v1_0;

import com.liferay.headless.forum.subscriptions.dto.v1_0.Subscriber;
import com.liferay.headless.forum.subscriptions.resource.v1_0.SubscriberResource;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.model.Subscription;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.service.SubscriptionLocalService;
import com.liferay.portal.kernel.service.UserLocalService;
import com.liferay.portal.vulcan.pagination.Page;

import java.util.ArrayList;
import java.util.List;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.component.annotations.ServiceScope;

/**
 * @author Neil Griffin
 */
@Component(
	properties = "OSGI-INF/liferay/rest/v1_0/subscriber.properties",
	scope = ServiceScope.PROTOTYPE, service = SubscriberResource.class
)
public class SubscriberResourceImpl extends BaseSubscriberResourceImpl {

	@Override
	public Page<Subscriber> getMessageSubscribersPage(Long messageId) {
		if (_log.isDebugEnabled()) {
			_log.debug(
				"getMessageSubscribersPage called with messageId=" +
					messageId);
		}

		List<Subscriber> subscribers = new ArrayList<>();
		long companyId = contextCompany.getCompanyId();

		String className;

		try {
			com.liferay.object.model.ObjectDefinition objectDefinition =
				_objectDefinitionLocalService.
					getObjectDefinitionByExternalReferenceCode(
						"FORUM-THREAD", companyId);

			className = objectDefinition.getClassName();
		}
		catch (Exception exception) {
			_log.error("Unable to find ForumThread object definition", exception);

			return Page.of(subscribers);
		}

		if (_log.isDebugEnabled()) {
			_log.debug(
				"Querying SubscriptionLocalService with companyId=" +
					companyId + ", className=" + className + ", classPK=" +
					messageId);
		}

		List<Subscription> subscriptions =
			_subscriptionLocalService.getSubscriptions(
				companyId, className, messageId);

		if (_log.isDebugEnabled()) {
			_log.debug(
				"SubscriptionLocalService returned " +
					subscriptions.size() + " subscription(s) for classPK=" +
					messageId);
		}

		for (Subscription subscription : subscriptions) {
			long subscriberUserId = subscription.getUserId();

			if (_log.isDebugEnabled()) {
				_log.debug(
					"Processing subscription: subscriptionId=" +
						subscription.getSubscriptionId() + ", userId=" +
						subscriberUserId + ", className=" +
						subscription.getClassName() + ", classPK=" +
						subscription.getClassPK() + ", frequency=" +
						subscription.getFrequency());
			}

			User user = _userLocalService.fetchUser(subscriberUserId);

			if (user != null) {
				Subscriber subscriber = new Subscriber();

				subscriber.setUserId(user.getUserId());
				subscriber.setEmailAddress(user.getEmailAddress());

				subscribers.add(subscriber);

				if (_log.isDebugEnabled()) {
					_log.debug(
						"Added subscriber: userId=" + user.getUserId() +
							", emailAddress=" + user.getEmailAddress() +
							", screenName=" + user.getScreenName());
				}
			}
			else {
				if (_log.isDebugEnabled()) {
					_log.debug(
						"Skipping subscription " +
							subscription.getSubscriptionId() +
							": no user found for userId=" +
							subscriberUserId);
				}
			}
		}

		if (_log.isDebugEnabled()) {
			_log.debug(
				"Returning " + subscribers.size() +
					" subscriber(s) for messageId=" + messageId);
		}

		return Page.of(subscribers);
	}

	private static final Log _log = LogFactoryUtil.getLog(
		SubscriberResourceImpl.class);

	@Reference
	private com.liferay.object.service.ObjectDefinitionLocalService
		_objectDefinitionLocalService;

	@Reference
	private SubscriptionLocalService _subscriptionLocalService;

	@Reference
	private UserLocalService _userLocalService;

}
