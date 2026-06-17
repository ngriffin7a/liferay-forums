package com.liferay.headless.forum.subscriptions.internal.graphql.mutation.v1_0;

import com.liferay.headless.forum.subscriptions.dto.v1_0.WebNotification;
import com.liferay.headless.forum.subscriptions.resource.v1_0.WebNotificationResource;
import com.liferay.petra.function.UnsafeConsumer;
import com.liferay.petra.function.UnsafeFunction;
import com.liferay.portal.kernel.service.GroupLocalService;
import com.liferay.portal.kernel.service.RoleLocalService;
import com.liferay.portal.vulcan.accept.language.AcceptLanguage;
import com.liferay.portal.vulcan.batch.engine.resource.VulcanBatchEngineExportTaskResource;
import com.liferay.portal.vulcan.batch.engine.resource.VulcanBatchEngineImportTaskResource;
import com.liferay.portal.vulcan.graphql.annotation.GraphQLField;
import com.liferay.portal.vulcan.graphql.annotation.GraphQLName;

import jakarta.annotation.Generated;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;

import java.util.function.BiFunction;

import org.osgi.service.component.ComponentServiceObjects;

/**
 * @author Neil Griffin
 * @generated
 */
@Generated("")
public class Mutation {

	public static void setWebNotificationResourceComponentServiceObjects(
		ComponentServiceObjects<WebNotificationResource>
			webNotificationResourceComponentServiceObjects) {

		_webNotificationResourceComponentServiceObjects =
			webNotificationResourceComponentServiceObjects;
	}

	@GraphQLField(
		description = "Sends an in-portal web notification to a user."
	)
	public WebNotification createWebNotification(
			@GraphQLName("webNotification") WebNotification webNotification)
		throws Exception {

		return _applyComponentServiceObjects(
			_webNotificationResourceComponentServiceObjects,
			this::_populateResourceContext,
			webNotificationResource ->
				webNotificationResource.postWebNotification(webNotification));
	}

	@GraphQLField
	public Response createWebNotificationBatch(
			@GraphQLName("callbackURL") String callbackURL,
			@GraphQLName("object") Object object)
		throws Exception {

		return _applyComponentServiceObjects(
			_webNotificationResourceComponentServiceObjects,
			this::_populateResourceContext,
			webNotificationResource ->
				webNotificationResource.postWebNotificationBatch(
					callbackURL, object));
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

	private <T, E1 extends Throwable, E2 extends Throwable> void
			_applyVoidComponentServiceObjects(
				ComponentServiceObjects<T> componentServiceObjects,
				UnsafeConsumer<T, E1> unsafeConsumer,
				UnsafeConsumer<T, E2> unsafeFunction)
		throws E1, E2 {

		T resource = componentServiceObjects.getService();

		try {
			unsafeConsumer.accept(resource);

			unsafeFunction.accept(resource);
		}
		finally {
			componentServiceObjects.ungetService(resource);
		}
	}

	private void _populateResourceContext(
			WebNotificationResource webNotificationResource)
		throws Exception {

		webNotificationResource.setContextAcceptLanguage(_acceptLanguage);
		webNotificationResource.setContextCompany(_company);
		webNotificationResource.setContextHttpServletRequest(
			_httpServletRequest);
		webNotificationResource.setContextHttpServletResponse(
			_httpServletResponse);
		webNotificationResource.setContextUriInfo(_uriInfo);
		webNotificationResource.setContextUser(_user);
		webNotificationResource.setGroupLocalService(_groupLocalService);
		webNotificationResource.setRoleLocalService(_roleLocalService);

		webNotificationResource.setVulcanBatchEngineExportTaskResource(
			_vulcanBatchEngineExportTaskResource);

		webNotificationResource.setVulcanBatchEngineImportTaskResource(
			_vulcanBatchEngineImportTaskResource);
	}

	private static ComponentServiceObjects<WebNotificationResource>
		_webNotificationResourceComponentServiceObjects;

	private AcceptLanguage _acceptLanguage;
	private com.liferay.portal.kernel.model.Company _company;
	private GroupLocalService _groupLocalService;
	private HttpServletRequest _httpServletRequest;
	private HttpServletResponse _httpServletResponse;
	private RoleLocalService _roleLocalService;
	private BiFunction<Object, String, com.liferay.portal.kernel.search.Sort[]>
		_sortsBiFunction;
	private UriInfo _uriInfo;
	private com.liferay.portal.kernel.model.User _user;
	private VulcanBatchEngineExportTaskResource
		_vulcanBatchEngineExportTaskResource;
	private VulcanBatchEngineImportTaskResource
		_vulcanBatchEngineImportTaskResource;

}