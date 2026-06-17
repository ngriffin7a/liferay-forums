package com.liferay.headless.forum.subscriptions.internal.graphql.servlet.v1_0;

import com.liferay.headless.forum.subscriptions.internal.graphql.mutation.v1_0.Mutation;
import com.liferay.headless.forum.subscriptions.internal.graphql.query.v1_0.Query;
import com.liferay.headless.forum.subscriptions.internal.resource.v1_0.SubscriberResourceImpl;
import com.liferay.headless.forum.subscriptions.internal.resource.v1_0.WebNotificationResourceImpl;
import com.liferay.headless.forum.subscriptions.resource.v1_0.SubscriberResource;
import com.liferay.headless.forum.subscriptions.resource.v1_0.WebNotificationResource;
import com.liferay.portal.kernel.util.ObjectValuePair;
import com.liferay.portal.vulcan.graphql.servlet.ServletData;

import jakarta.annotation.Generated;

import java.util.HashMap;
import java.util.Map;

import org.osgi.framework.BundleContext;
import org.osgi.service.component.ComponentServiceObjects;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.component.annotations.ReferenceScope;

/**
 * @author Neil Griffin
 * @generated
 */
@Component(service = ServletData.class)
@Generated("")
public class ServletDataImpl implements ServletData {

	@Activate
	public void activate(BundleContext bundleContext) {
		Mutation.setWebNotificationResourceComponentServiceObjects(
			_webNotificationResourceComponentServiceObjects);

		Query.setSubscriberResourceComponentServiceObjects(
			_subscriberResourceComponentServiceObjects);
	}

	public String getApplicationName() {
		return "Liferay.Forum.Subscriptions";
	}

	@Override
	public Mutation getMutation() {
		return new Mutation();
	}

	@Override
	public String getPath() {
		return "/forum-subscriptions-graphql/v1_0";
	}

	@Override
	public Query getQuery() {
		return new Query();
	}

	public ObjectValuePair<Class<?>, String> getResourceMethodObjectValuePair(
		String methodName, boolean mutation) {

		if (mutation) {
			return _resourceMethodObjectValuePairs.get(
				"mutation#" + methodName);
		}

		return _resourceMethodObjectValuePairs.get("query#" + methodName);
	}

	private static final Map<String, ObjectValuePair<Class<?>, String>>
		_resourceMethodObjectValuePairs =
			new HashMap<String, ObjectValuePair<Class<?>, String>>() {
				{
					put(
						"mutation#createWebNotification",
						new ObjectValuePair<>(
							WebNotificationResourceImpl.class,
							"postWebNotification"));
					put(
						"mutation#createWebNotificationBatch",
						new ObjectValuePair<>(
							WebNotificationResourceImpl.class,
							"postWebNotificationBatch"));

					put(
						"query#messageSubscribers",
						new ObjectValuePair<>(
							SubscriberResourceImpl.class,
							"getMessageSubscribersPage"));
				}
			};

	@Reference(scope = ReferenceScope.PROTOTYPE_REQUIRED)
	private ComponentServiceObjects<WebNotificationResource>
		_webNotificationResourceComponentServiceObjects;

	@Reference(scope = ReferenceScope.PROTOTYPE_REQUIRED)
	private ComponentServiceObjects<SubscriberResource>
		_subscriberResourceComponentServiceObjects;

}