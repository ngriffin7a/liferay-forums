/* Backfills createDate/modifiedDate from displayDate on the shared ObjectEntry
 * table for ForumThread and ForumMessage object entries, so demo content shows
 * the intended historical dates instead of the import date.
 *
 * Both columns are TIMESTAMP (Types.TIMESTAMP in JDBC / DATE in Liferay DDL),
 * so there is no precision mismatch.
 *
 * Run this AFTER 1-create-demo-data.py has populated all entries, via
 * Control Panel -> Server Administration -> Script (language: Groovy).
 *
 * Direct ObjectEntry writes bypass the entity cache, so afterwards clear caches:
 * Control Panel -> Server Administration -> Actions -> "Clear All Caches".
 *
 * Object definitions are resolved via ObjectDefinitionLocalServiceUtil by
 * external reference code (FORUM-THREAD / FORUM-MESSAGE) so the script does not
 * depend on the ObjectDefinition.name format or on environment-specific ids.
 * Idempotent: rerunning just re-copies displayDate onto the same rows.
 */

import com.liferay.object.service.ObjectDefinitionLocalServiceUtil
import com.liferay.portal.kernel.dao.jdbc.DataAccess
import com.liferay.portal.kernel.util.PortalUtil

def companyId = PortalUtil.getDefaultCompanyId()
def conn = DataAccess.getConnection()

/* Copy displayDate -> createDate/modifiedDate for every ObjectEntry of the
 * object definition with the given external reference code. Returns rows updated. */
def backfill = { erc ->
	def objectDefinition =
		ObjectDefinitionLocalServiceUtil.fetchObjectDefinitionByExternalReferenceCode(erc, companyId)

	if (objectDefinition == null) {
		out.println("  WARN: ObjectDefinition not found for ERC: ${erc}")
		return 0
	}

	def upd = conn.prepareStatement(
		"UPDATE ObjectEntry SET createDate = displayDate, modifiedDate = displayDate " +
		"WHERE objectDefinitionId = ? AND displayDate IS NOT NULL")
	upd.setLong(1, objectDefinition.getObjectDefinitionId())
	def count = upd.executeUpdate()
	upd.close()
	return count
}

def threadCount = backfill("FORUM-THREAD")
def messageCount = backfill("FORUM-MESSAGE")

conn.close()

out.println("Done: backfilled createDate/modifiedDate from displayDate for ${threadCount} ForumThread and ${messageCount} ForumMessage entries")
