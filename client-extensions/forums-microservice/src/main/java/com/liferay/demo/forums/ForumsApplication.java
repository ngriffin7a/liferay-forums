// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums;

import com.liferay.client.extension.util.spring.boot3.ClientExtensionUtilSpringBootComponentScan;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/**
 * @author Neil Griffin
 */
@SpringBootApplication
public class ForumsApplication {

	public static void main(String[] args) throws Exception {
		SpringApplication.run(ForumsApplication.class, args);
	}

	@Configuration
	@Import(ClientExtensionUtilSpringBootComponentScan.class)
	public static class LiferayClientExtensionConfig {
	}

}
