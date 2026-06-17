package com.liferay.headless.forum.subscriptions.internal.notifications;

import com.liferay.portal.kernel.json.JSONFactoryUtil;
import com.liferay.portal.kernel.json.JSONObject;
import com.liferay.portal.kernel.model.UserNotificationEvent;
import com.liferay.portal.kernel.notifications.BaseUserNotificationHandler;
import com.liferay.portal.kernel.notifications.UserNotificationFeedEntry;
import com.liferay.portal.kernel.notifications.UserNotificationHandler;
import com.liferay.portal.kernel.service.ServiceContext;
import com.liferay.portal.kernel.util.StringUtil;

import org.osgi.service.component.annotations.Component;

@Component(
	property = "javax.portlet.name=LiferayForums",
	service = UserNotificationHandler.class
)
public class ForumUserNotificationHandler extends BaseUserNotificationHandler {

	public ForumUserNotificationHandler() {
		setPortletId("LiferayForums");
	}

	@Override
	protected UserNotificationFeedEntry doInterpret(
			UserNotificationEvent userNotificationEvent,
			ServiceContext serviceContext)
		throws Exception {

		JSONObject jsonObject = JSONFactoryUtil.createJSONObject(
			userNotificationEvent.getPayload());

		String body = jsonObject.getString("body");
		String subject = jsonObject.getString("subject");
		String url = jsonObject.getString("url", "");

		String title = StringUtil.replace(
			"<strong>[$SUBJECT$]</strong><div class=\"text-truncate\">[$BODY$]</div>",
			new String[] {"[$SUBJECT$]", "[$BODY$]"},
			new String[] {subject, body});

		return new UserNotificationFeedEntry(false, title, url, true, title);
	}

}
