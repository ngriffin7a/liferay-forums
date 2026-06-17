package com.liferay.headless.forum.subscriptions.internal.jaxrs.application;

import jakarta.annotation.Generated;

import jakarta.ws.rs.core.Application;

import org.osgi.service.component.annotations.Component;

/**
 * @author Neil Griffin
 * @generated
 */
@Component(
	property = {
		"liferay.jackson=false",
		"osgi.jaxrs.application.base=/forum-subscriptions",
		"osgi.jaxrs.extension.select=(osgi.jaxrs.name=Liferay.Vulcan)",
		"osgi.jaxrs.name=Liferay.Forum.Subscriptions"
	},
	service = Application.class
)
@Generated("")
public class ForumSubscriptionsApplication extends Application {
}