package com.liferay.headless.forum.subscriptions.client.dto.v1_0;

import com.liferay.headless.forum.subscriptions.client.function.UnsafeSupplier;
import com.liferay.headless.forum.subscriptions.client.serdes.v1_0.WebNotificationSerDes;

import jakarta.annotation.Generated;

import java.io.Serializable;

import java.util.Objects;

/**
 * @author Neil Griffin
 * @generated
 */
@Generated("")
public class WebNotification implements Cloneable, Serializable {

	public static WebNotification toDTO(String json) {
		return WebNotificationSerDes.toDTO(json);
	}

	public String getBody() {
		return body;
	}

	public void setBody(String body) {
		this.body = body;
	}

	public void setBody(UnsafeSupplier<String, Exception> bodyUnsafeSupplier) {
		try {
			body = bodyUnsafeSupplier.get();
		}
		catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	protected String body;

	public String getSubject() {
		return subject;
	}

	public void setSubject(String subject) {
		this.subject = subject;
	}

	public void setSubject(
		UnsafeSupplier<String, Exception> subjectUnsafeSupplier) {

		try {
			subject = subjectUnsafeSupplier.get();
		}
		catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	protected String subject;

	public String getUrl() {
		return url;
	}

	public void setUrl(String url) {
		this.url = url;
	}

	public void setUrl(UnsafeSupplier<String, Exception> urlUnsafeSupplier) {
		try {
			url = urlUnsafeSupplier.get();
		}
		catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	protected String url;

	public Long[] getUserIds() {
		return userIds;
	}

	public void setUserIds(Long[] userIds) {
		this.userIds = userIds;
	}

	public void setUserIds(
		UnsafeSupplier<Long[], Exception> userIdsUnsafeSupplier) {

		try {
			userIds = userIdsUnsafeSupplier.get();
		}
		catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	protected Long[] userIds;

	@Override
	public WebNotification clone() throws CloneNotSupportedException {
		return (WebNotification)super.clone();
	}

	@Override
	public boolean equals(Object object) {
		if (this == object) {
			return true;
		}

		if (!(object instanceof WebNotification)) {
			return false;
		}

		WebNotification webNotification = (WebNotification)object;

		return Objects.equals(toString(), webNotification.toString());
	}

	@Override
	public int hashCode() {
		String string = toString();

		return string.hashCode();
	}

	public String toString() {
		return WebNotificationSerDes.toJSON(this);
	}

}