// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.config;

import com.liferay.demo.forums.client.LiferayApiClient;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * @author Neil Griffin
 */
@Configuration
public class LiferayApiClientConfig {

	private static final Logger _log = LoggerFactory.getLogger(LiferayApiClientConfig.class);

	@Bean
	public LiferayApiClient liferayApiClient(
		@Value("${liferay.api.base.url}") String baseUrl,
		@Value("${liferay.headless.api.user:}") String user,
		@Value("${liferay.headless.api.password:}") String password) {

		_log.info("Creating LiferayApiClient targeting: {}", baseUrl);

		return new LiferayApiClient(baseUrl, user, password);
	}

}
