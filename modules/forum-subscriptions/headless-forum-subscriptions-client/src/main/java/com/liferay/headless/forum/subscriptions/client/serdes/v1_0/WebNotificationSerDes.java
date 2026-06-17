package com.liferay.headless.forum.subscriptions.client.serdes.v1_0;

import com.liferay.headless.forum.subscriptions.client.dto.v1_0.WebNotification;
import com.liferay.headless.forum.subscriptions.client.json.BaseJSONParser;

import jakarta.annotation.Generated;

import java.util.Iterator;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

/**
 * @author Neil Griffin
 * @generated
 */
@Generated("")
public class WebNotificationSerDes {

	public static WebNotification toDTO(String json) {
		WebNotificationJSONParser webNotificationJSONParser =
			new WebNotificationJSONParser();

		return webNotificationJSONParser.parseToDTO(json);
	}

	public static WebNotification[] toDTOs(String json) {
		WebNotificationJSONParser webNotificationJSONParser =
			new WebNotificationJSONParser();

		return webNotificationJSONParser.parseToDTOs(json);
	}

	public static String toJSON(WebNotification webNotification) {
		if (webNotification == null) {
			return "null";
		}

		StringBuilder sb = new StringBuilder();

		sb.append("{");

		if (webNotification.getBody() != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"body\": ");

			sb.append("\"");

			sb.append(_escape(webNotification.getBody()));

			sb.append("\"");
		}

		if (webNotification.getSubject() != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"subject\": ");

			sb.append("\"");

			sb.append(_escape(webNotification.getSubject()));

			sb.append("\"");
		}

		if (webNotification.getUrl() != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"url\": ");

			sb.append("\"");

			sb.append(_escape(webNotification.getUrl()));

			sb.append("\"");
		}

		if (webNotification.getUserIds() != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"userIds\": ");

			sb.append("[");

			for (int i = 0; i < webNotification.getUserIds().length; i++) {
				sb.append(webNotification.getUserIds()[i]);

				if ((i + 1) < webNotification.getUserIds().length) {
					sb.append(", ");
				}
			}

			sb.append("]");
		}

		sb.append("}");

		return sb.toString();
	}

	public static Map<String, Object> toMap(String json) {
		WebNotificationJSONParser webNotificationJSONParser =
			new WebNotificationJSONParser();

		return webNotificationJSONParser.parseToMap(json);
	}

	public static Map<String, String> toMap(WebNotification webNotification) {
		if (webNotification == null) {
			return null;
		}

		Map<String, String> map = new TreeMap<>();

		if (webNotification.getBody() == null) {
			map.put("body", null);
		}
		else {
			map.put("body", String.valueOf(webNotification.getBody()));
		}

		if (webNotification.getSubject() == null) {
			map.put("subject", null);
		}
		else {
			map.put("subject", String.valueOf(webNotification.getSubject()));
		}

		if (webNotification.getUrl() == null) {
			map.put("url", null);
		}
		else {
			map.put("url", String.valueOf(webNotification.getUrl()));
		}

		if (webNotification.getUserIds() == null) {
			map.put("userIds", null);
		}
		else {
			map.put("userIds", String.valueOf(webNotification.getUserIds()));
		}

		return map;
	}

	public static class WebNotificationJSONParser
		extends BaseJSONParser<WebNotification> {

		@Override
		protected WebNotification createDTO() {
			return new WebNotification();
		}

		@Override
		protected WebNotification[] createDTOArray(int size) {
			return new WebNotification[size];
		}

		@Override
		protected boolean parseMaps(String jsonParserFieldName) {
			if (Objects.equals(jsonParserFieldName, "body")) {
				return false;
			}
			else if (Objects.equals(jsonParserFieldName, "subject")) {
				return false;
			}
			else if (Objects.equals(jsonParserFieldName, "url")) {
				return false;
			}
			else if (Objects.equals(jsonParserFieldName, "userIds")) {
				return false;
			}

			return false;
		}

		@Override
		protected void setField(
			WebNotification webNotification, String jsonParserFieldName,
			Object jsonParserFieldValue) {

			if (Objects.equals(jsonParserFieldName, "body")) {
				if (jsonParserFieldValue != null) {
					webNotification.setBody((String)jsonParserFieldValue);
				}
			}
			else if (Objects.equals(jsonParserFieldName, "subject")) {
				if (jsonParserFieldValue != null) {
					webNotification.setSubject((String)jsonParserFieldValue);
				}
			}
			else if (Objects.equals(jsonParserFieldName, "url")) {
				if (jsonParserFieldValue != null) {
					webNotification.setUrl((String)jsonParserFieldValue);
				}
			}
			else if (Objects.equals(jsonParserFieldName, "userIds")) {
				if (jsonParserFieldValue != null) {
					webNotification.setUserIds(
						toLongs((Object[])jsonParserFieldValue));
				}
			}
		}

	}

	private static String _escape(Object object) {
		String string = String.valueOf(object);

		for (String[] strings : BaseJSONParser.JSON_ESCAPE_STRINGS) {
			string = string.replace(strings[0], strings[1]);
		}

		return string;
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
			sb.append(entry.getKey());
			sb.append("\": ");

			Object value = entry.getValue();

			sb.append(_toJSON(value));

			if (iterator.hasNext()) {
				sb.append(", ");
			}
		}

		sb.append("}");

		return sb.toString();
	}

	private static String _toJSON(Object value) {
		if (value == null) {
			return "null";
		}

		if (value instanceof Map) {
			return _toJSON((Map)value);
		}

		Class<?> clazz = value.getClass();

		if (clazz.isArray()) {
			StringBuilder sb = new StringBuilder("[");

			Object[] values = (Object[])value;

			for (int i = 0; i < values.length; i++) {
				sb.append(_toJSON(values[i]));

				if ((i + 1) < values.length) {
					sb.append(", ");
				}
			}

			sb.append("]");

			return sb.toString();
		}

		if (value instanceof String) {
			return "\"" + _escape(value) + "\"";
		}

		return String.valueOf(value);
	}

}