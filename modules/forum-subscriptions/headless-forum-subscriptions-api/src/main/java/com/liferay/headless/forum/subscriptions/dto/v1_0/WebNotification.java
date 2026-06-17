package com.liferay.headless.forum.subscriptions.dto.v1_0;

import com.fasterxml.jackson.annotation.JsonFilter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import com.liferay.petra.function.UnsafeSupplier;
import com.liferay.petra.string.StringBundler;
import com.liferay.portal.kernel.util.StringUtil;
import com.liferay.portal.vulcan.graphql.annotation.GraphQLField;
import com.liferay.portal.vulcan.graphql.annotation.GraphQLName;
import com.liferay.portal.vulcan.util.ObjectMapperUtil;

import jakarta.annotation.Generated;

import jakarta.xml.bind.annotation.XmlRootElement;

import java.io.Serializable;

import java.util.Iterator;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;

/**
 * @author Neil Griffin
 * @generated
 */
@Generated("")
@GraphQLName(
	description = "An in-portal notification for a user.",
	value = "WebNotification"
)
@JsonFilter("Liferay.Vulcan")
@XmlRootElement(name = "WebNotification")
public class WebNotification implements Serializable {

	public static WebNotification toDTO(String json) {
		return ObjectMapperUtil.readValue(WebNotification.class, json);
	}

	public static WebNotification unsafeToDTO(String json) {
		return ObjectMapperUtil.unsafeReadValue(WebNotification.class, json);
	}

	@io.swagger.v3.oas.annotations.media.Schema
	public String getBody() {
		if (_bodySupplier != null) {
			body = _bodySupplier.get();

			_bodySupplier = null;
		}

		return body;
	}

	public void setBody(String body) {
		this.body = body;

		_bodySupplier = null;
	}

	@JsonIgnore
	public void setBody(UnsafeSupplier<String, Exception> bodyUnsafeSupplier) {
		_bodySupplier = () -> {
			try {
				return bodyUnsafeSupplier.get();
			}
			catch (RuntimeException runtimeException) {
				throw runtimeException;
			}
			catch (Exception exception) {
				throw new RuntimeException(exception);
			}
		};
	}

	@GraphQLField
	@JsonProperty(access = JsonProperty.Access.READ_WRITE)
	protected String body;

	@JsonIgnore
	private Supplier<String> _bodySupplier;

	@io.swagger.v3.oas.annotations.media.Schema
	public String getSubject() {
		if (_subjectSupplier != null) {
			subject = _subjectSupplier.get();

			_subjectSupplier = null;
		}

		return subject;
	}

	public void setSubject(String subject) {
		this.subject = subject;

		_subjectSupplier = null;
	}

	@JsonIgnore
	public void setSubject(
		UnsafeSupplier<String, Exception> subjectUnsafeSupplier) {

		_subjectSupplier = () -> {
			try {
				return subjectUnsafeSupplier.get();
			}
			catch (RuntimeException runtimeException) {
				throw runtimeException;
			}
			catch (Exception exception) {
				throw new RuntimeException(exception);
			}
		};
	}

	@GraphQLField
	@JsonProperty(access = JsonProperty.Access.READ_WRITE)
	protected String subject;

	@JsonIgnore
	private Supplier<String> _subjectSupplier;

	@io.swagger.v3.oas.annotations.media.Schema
	public String getUrl() {
		if (_urlSupplier != null) {
			url = _urlSupplier.get();

			_urlSupplier = null;
		}

		return url;
	}

	public void setUrl(String url) {
		this.url = url;

		_urlSupplier = null;
	}

	@JsonIgnore
	public void setUrl(UnsafeSupplier<String, Exception> urlUnsafeSupplier) {
		_urlSupplier = () -> {
			try {
				return urlUnsafeSupplier.get();
			}
			catch (RuntimeException runtimeException) {
				throw runtimeException;
			}
			catch (Exception exception) {
				throw new RuntimeException(exception);
			}
		};
	}

	@GraphQLField
	@JsonProperty(access = JsonProperty.Access.READ_WRITE)
	protected String url;

	@JsonIgnore
	private Supplier<String> _urlSupplier;

	@io.swagger.v3.oas.annotations.media.Schema
	public Long[] getUserIds() {
		if (_userIdsSupplier != null) {
			userIds = _userIdsSupplier.get();

			_userIdsSupplier = null;
		}

		return userIds;
	}

	public void setUserIds(Long[] userIds) {
		this.userIds = userIds;

		_userIdsSupplier = null;
	}

	@JsonIgnore
	public void setUserIds(
		UnsafeSupplier<Long[], Exception> userIdsUnsafeSupplier) {

		_userIdsSupplier = () -> {
			try {
				return userIdsUnsafeSupplier.get();
			}
			catch (RuntimeException runtimeException) {
				throw runtimeException;
			}
			catch (Exception exception) {
				throw new RuntimeException(exception);
			}
		};
	}

	@GraphQLField
	@JsonProperty(access = JsonProperty.Access.READ_WRITE)
	protected Long[] userIds;

	@JsonIgnore
	private Supplier<Long[]> _userIdsSupplier;

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
		StringBundler sb = new StringBundler();

		sb.append("{");

		String body = getBody();

		if (body != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"body\": ");

			sb.append("\"");

			sb.append(_escape(body));

			sb.append("\"");
		}

		String subject = getSubject();

		if (subject != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"subject\": ");

			sb.append("\"");

			sb.append(_escape(subject));

			sb.append("\"");
		}

		String url = getUrl();

		if (url != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"url\": ");

			sb.append("\"");

			sb.append(_escape(url));

			sb.append("\"");
		}

		Long[] userIds = getUserIds();

		if (userIds != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"userIds\": ");

			sb.append("[");

			for (int i = 0; i < userIds.length; i++) {
				sb.append(userIds[i]);

				if ((i + 1) < userIds.length) {
					sb.append(", ");
				}
			}

			sb.append("]");
		}

		sb.append("}");

		return sb.toString();
	}

	@io.swagger.v3.oas.annotations.media.Schema(
		accessMode = io.swagger.v3.oas.annotations.media.Schema.AccessMode.READ_ONLY,
		defaultValue = "com.liferay.headless.forum.subscriptions.dto.v1_0.WebNotification",
		name = "x-class-name"
	)
	public String xClassName;

	private static String _escape(Object object) {
		return StringUtil.replace(
			String.valueOf(object), _JSON_ESCAPE_STRINGS[0],
			_JSON_ESCAPE_STRINGS[1]);
	}

	private static boolean _isArray(Object value) {
		if (value == null) {
			return false;
		}

		Class<?> clazz = value.getClass();

		return clazz.isArray();
	}

	private static String _toJSON(Map<String, ?> map) {
		StringBuilder sb = new StringBuilder("{");

		@SuppressWarnings("unchecked")
		Set set = map.entrySet();

		@SuppressWarnings("unchecked")
		Iterator<Map.Entry<String, ?>> iterator = set.iterator();

		while (iterator.hasNext()) {
			Map.Entry<String, ?> entry = iterator.next();

			sb.append("\"");
			sb.append(_escape(entry.getKey()));
			sb.append("\": ");

			Object value = entry.getValue();

			if (_isArray(value)) {
				sb.append("[");

				Object[] valueArray = (Object[])value;

				for (int i = 0; i < valueArray.length; i++) {
					if (valueArray[i] instanceof Map) {
						sb.append(_toJSON((Map<String, ?>)valueArray[i]));
					}
					else if (valueArray[i] instanceof String) {
						sb.append("\"");
						sb.append(valueArray[i]);
						sb.append("\"");
					}
					else {
						sb.append(valueArray[i]);
					}

					if ((i + 1) < valueArray.length) {
						sb.append(", ");
					}
				}

				sb.append("]");
			}
			else if (value instanceof Map) {
				sb.append(_toJSON((Map<String, ?>)value));
			}
			else if (value instanceof String) {
				sb.append("\"");
				sb.append(_escape(value));
				sb.append("\"");
			}
			else {
				sb.append(value);
			}

			if (iterator.hasNext()) {
				sb.append(", ");
			}
		}

		sb.append("}");

		return sb.toString();
	}

	private static final String[][] _JSON_ESCAPE_STRINGS = {
		{"\\", "\"", "\b", "\f", "\n", "\r", "\t"},
		{"\\\\", "\\\"", "\\b", "\\f", "\\n", "\\r", "\\t"}
	};

	private Map<String, Serializable> _extendedProperties;

}