// SPDX-License-Identifier: LGPL-2.1-or-later
package com.liferay.demo.forums.service;

public class Subscriber {

	public Subscriber(long userId, String emailAddress) {
		_userId = userId;
		_emailAddress = emailAddress;
	}

	public String getEmailAddress() {
		return _emailAddress;
	}

	public long getUserId() {
		return _userId;
	}

	private final String _emailAddress;
	private final long _userId;

}
