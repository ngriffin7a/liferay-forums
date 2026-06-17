package com.liferay.headless.forum.subscriptions.internal.resource.v1_0;

import com.liferay.headless.forum.subscriptions.resource.v1_0.WebNotificationResource;

import com.liferay.headless.forum.subscriptions.dto.v1_0.WebNotification;
import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.model.UserNotificationDeliveryConstants;
import com.liferay.portal.kernel.service.UserNotificationEventLocalService;

import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.component.annotations.ServiceScope;

/**
 * @author Neil Griffin
 */
@Component(
	properties = "OSGI-INF/liferay/rest/v1_0/web-notification.properties",
	scope = ServiceScope.PROTOTYPE, service = WebNotificationResource.class
)
public class WebNotificationResourceImpl
	extends BaseWebNotificationResourceImpl {

	@Override
	public WebNotification postWebNotification(
			WebNotification webNotification)
		throws Exception {

		JSONObject jsonObject = JSONFactoryUtil.createJSONObject();

		jsonObject.put("body", webNotification.getBody());
		jsonObject.put("subject", webNotification.getSubject());
		jsonObject.put("url", webNotification.getUrl());

		Long[] userIds = webNotification.getUserIds();

		if (userIds != null) {
			for (long userId : userIds) {
				_userNotificationEventLocalService.sendUserNotificationEvents(
					userId, "LiferayForums",
					UserNotificationDeliveryConstants.TYPE_WEBSITE, true, false,
					jsonObject);
			}
		}

		return webNotification;
	}

	@Reference
	private UserNotificationEventLocalService
		_userNotificationEventLocalService;

}