package com.liferay.headless.forum.subscriptions.internal.graphql.query.v1_0;

import com.liferay.headless.forum.subscriptions.dto.v1_0.Subscriber;
import com.liferay.headless.forum.subscriptions.resource.v1_0.SubscriberResource;
import com.liferay.petra.function.UnsafeConsumer;
import com.liferay.petra.function.UnsafeFunction;
import com.liferay.portal.kernel.service.GroupLocalService;
import com.liferay.portal.kernel.service.ResourceActionLocalService;
import com.liferay.portal.kernel.service.ResourcePermissionLocalService;
import com.liferay.portal.kernel.service.RoleLocalService;
import com.liferay.portal.vulcan.accept.language.AcceptLanguage;
import com.liferay.portal.vulcan.graphql.annotation.GraphQLField;
import com.liferay.portal.vulcan.graphql.annotation.GraphQLName;
import com.liferay.portal.vulcan.pagination.Page;

import jakarta.annotation.Generated;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import jakarta.ws.rs.core.UriInfo;

import java.util.Map;
import java.util.function.BiFunction;

import org.osgi.service.component.ComponentServiceObjects;

/**
 * @author Neil Griffin
 * @generated
 */
@Generated("")
public class Query {

	public static void setSubscriberResourceComponentServiceObjects(
		ComponentServiceObjects<SubscriberResource>
			subscriberResourceComponentServiceObjects) {

		_subscriberResourceComponentServiceObjects =
			subscriberResourceComponentServiceObjects;
	}

	/**
	 * Invoke this method with the command line:
	 *
	 * curl -H 'Content-Type: text/plain; charset=utf-8' -X 'POST' 'http://localhost:8080/o/graphql' -d $'{"query": "query {messageSubscribers(messageId: ___){items {__}, page, pageSize, totalCount}}"}' -u 'test@liferay.com:test'
	 */
	@GraphQLField(
		description = "Returns all users subscribed to the ForumMessage with the given ID."
	)
	public SubscriberPage messageSubscribers(
			@GraphQLName("messageId") Long messageId)
		throws Exception {

		return _applyComponentServiceObjects(
			_subscriberResourceComponentServiceObjects,
			this::_populateResourceContext,
			subscriberResource -> new SubscriberPage(
				subscriberResource.getMessageSubscribersPage(messageId)));
	}

	@GraphQLName("SubscriberPage")
	public class SubscriberPage {

		public SubscriberPage(Page subscriberPage) {
			actions = subscriberPage.getActions();

			items = subscriberPage.getItems();
			lastPage = subscriberPage.getLastPage();
			page = subscriberPage.getPage();
			pageSize = subscriberPage.getPageSize();
			totalCount = subscriberPage.getTotalCount();
		}

		@GraphQLField
		protected Map<String, Map<String, String>> actions;

		@GraphQLField
		protected java.util.Collection<Subscriber> items;

		@GraphQLField
		protected long lastPage;

		@GraphQLField
		protected long page;

		@GraphQLField
		protected long pageSize;

		@GraphQLField
		protected long totalCount;

	}

	private <T, R, E1 extends Throwable, E2 extends Throwable> R
			_applyComponentServiceObjects(
				ComponentServiceObjects<T> componentServiceObjects,
				UnsafeConsumer<T, E1> unsafeConsumer,
				UnsafeFunction<T, R, E2> unsafeFunction)
		throws E1, E2 {

		T resource = componentServiceObjects.getService();

		try {
			unsafeConsumer.accept(resource);

			return unsafeFunction.apply(resource);
		}
		finally {
			componentServiceObjects.ungetService(resource);
		}
	}

	private void _populateResourceContext(SubscriberResource subscriberResource)
		throws Exception {

		subscriberResource.setContextAcceptLanguage(_acceptLanguage);
		subscriberResource.setContextCompany(_company);
		subscriberResource.setContextHttpServletRequest(_httpServletRequest);
		subscriberResource.setContextHttpServletResponse(_httpServletResponse);
		subscriberResource.setContextUriInfo(_uriInfo);
		subscriberResource.setContextUser(_user);
		subscriberResource.setGroupLocalService(_groupLocalService);
		subscriberResource.setResourceActionLocalService(
			_resourceActionLocalService);
		subscriberResource.setResourcePermissionLocalService(
			_resourcePermissionLocalService);
		subscriberResource.setRoleLocalService(_roleLocalService);
	}

	private static ComponentServiceObjects<SubscriberResource>
		_subscriberResourceComponentServiceObjects;

	private AcceptLanguage _acceptLanguage;
	private com.liferay.portal.kernel.model.Company _company;
	private BiFunction
		<Object, String, com.liferay.portal.kernel.search.filter.Filter>
			_filterBiFunction;
	private GroupLocalService _groupLocalService;
	private HttpServletRequest _httpServletRequest;
	private HttpServletResponse _httpServletResponse;
	private ResourceActionLocalService _resourceActionLocalService;
	private ResourcePermissionLocalService _resourcePermissionLocalService;
	private RoleLocalService _roleLocalService;
	private BiFunction<Object, String, com.liferay.portal.kernel.search.Sort[]>
		_sortsBiFunction;
	private UriInfo _uriInfo;
	private com.liferay.portal.kernel.model.User _user;

}