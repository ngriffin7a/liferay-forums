package com.liferay.headless.forum.subscriptions.client.serdes.v1_0;

import com.liferay.headless.forum.subscriptions.client.dto.v1_0.Subscriber;
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
public class SubscriberSerDes {

	public static Subscriber toDTO(String json) {
		SubscriberJSONParser subscriberJSONParser = new SubscriberJSONParser();

		return subscriberJSONParser.parseToDTO(json);
	}

	public static Subscriber[] toDTOs(String json) {
		SubscriberJSONParser subscriberJSONParser = new SubscriberJSONParser();

		return subscriberJSONParser.parseToDTOs(json);
	}

	public static String toJSON(Subscriber subscriber) {
		if (subscriber == null) {
			return "null";
		}

		StringBuilder sb = new StringBuilder();

		sb.append("{");

		if (subscriber.getEmailAddress() != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"emailAddress\": ");

			sb.append("\"");

			sb.append(_escape(subscriber.getEmailAddress()));

			sb.append("\"");
		}

		if (subscriber.getUserId() != null) {
			if (sb.length() > 1) {
				sb.append(", ");
			}

			sb.append("\"userId\": ");

			sb.append(subscriber.getUserId());
		}

		sb.append("}");

		return sb.toString();
	}

	public static Map<String, Object> toMap(String json) {
		SubscriberJSONParser subscriberJSONParser = new SubscriberJSONParser();

		return subscriberJSONParser.parseToMap(json);
	}

	public static Map<String, String> toMap(Subscriber subscriber) {
		if (subscriber == null) {
			return null;
		}

		Map<String, String> map = new TreeMap<>();

		if (subscriber.getEmailAddress() == null) {
			map.put("emailAddress", null);
		}
		else {
			map.put(
				"emailAddress", String.valueOf(subscriber.getEmailAddress()));
		}

		if (subscriber.getUserId() == null) {
			map.put("userId", null);
		}
		else {
			map.put("userId", String.valueOf(subscriber.getUserId()));
		}

		return map;
	}

	public static class SubscriberJSONParser
		extends BaseJSONParser<Subscriber> {

		@Override
		protected Subscriber createDTO() {
			return new Subscriber();
		}

		@Override
		protected Subscriber[] createDTOArray(int size) {
			return new Subscriber[size];
		}

		@Override
		protected boolean parseMaps(String jsonParserFieldName) {
			if (Objects.equals(jsonParserFieldName, "emailAddress")) {
				return false;
			}
			else if (Objects.equals(jsonParserFieldName, "userId")) {
				return false;
			}

			return false;
		}

		@Override
		protected void setField(
			Subscriber subscriber, String jsonParserFieldName,
			Object jsonParserFieldValue) {

			if (Objects.equals(jsonParserFieldName, "emailAddress")) {
				if (jsonParserFieldValue != null) {
					subscriber.setEmailAddress((String)jsonParserFieldValue);
				}
			}
			else if (Objects.equals(jsonParserFieldName, "userId")) {
				if (jsonParserFieldValue != null) {
					subscriber.setUserId(
						Long.valueOf((String)jsonParserFieldValue));
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