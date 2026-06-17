package com.liferay.headless.forum.subscriptions.client.dto.v1_0;

import com.liferay.headless.forum.subscriptions.client.function.UnsafeSupplier;
import com.liferay.headless.forum.subscriptions.client.serdes.v1_0.SubscriberSerDes;

import jakarta.annotation.Generated;

import java.io.Serializable;

import java.util.Objects;

/**
 * @author Neil Griffin
 * @generated
 */
@Generated("")
public class Subscriber implements Cloneable, Serializable {

	public static Subscriber toDTO(String json) {
		return SubscriberSerDes.toDTO(json);
	}

	public String getEmailAddress() {
		return emailAddress;
	}

	public void setEmailAddress(String emailAddress) {
		this.emailAddress = emailAddress;
	}

	public void setEmailAddress(
		UnsafeSupplier<String, Exception> emailAddressUnsafeSupplier) {

		try {
			emailAddress = emailAddressUnsafeSupplier.get();
		}
		catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	protected String emailAddress;

	public Long getUserId() {
		return userId;
	}

	public void setUserId(Long userId) {
		this.userId = userId;
	}

	public void setUserId(
		UnsafeSupplier<Long, Exception> userIdUnsafeSupplier) {

		try {
			userId = userIdUnsafeSupplier.get();
		}
		catch (Exception e) {
			throw new RuntimeException(e);
		}
	}

	protected Long userId;

	@Override
	public Subscriber clone() throws CloneNotSupportedException {
		return (Subscriber)super.clone();
	}

	@Override
	public boolean equals(Object object) {
		if (this == object) {
			return true;
		}

		if (!(object instanceof Subscriber)) {
			return false;
		}

		Subscriber subscriber = (Subscriber)object;

		return Objects.equals(toString(), subscriber.toString());
	}

	@Override
	public int hashCode() {
		String string = toString();

		return string.hashCode();
	}

	public String toString() {
		return SubscriberSerDes.toJSON(this);
	}

}