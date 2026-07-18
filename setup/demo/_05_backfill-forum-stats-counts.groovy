// SPDX-License-Identifier: LGPL-2.1-or-later
/**
 * Repairs the ForumStatsUser records that drive the forums-hero "Top Posters"
 * leaderboard and PARTICIPANTS count. Run this AFTER the other setup scripts
 * (_01_create-demo-data.py, _02_reassign-authors, _03_backfill-create-dates,
 * _04_backfill-forum-stats-users).
 *
 * It fixes three problems, none of which the earlier scripts handle:
 *
 *   1. messageCount / lastPostDate are never populated, so every poster shows
 *      "0 posts" and is stuck at the lowest rank (Youngling). This script counts
 *      each member's ForumMessage entries and writes messageCount + lastPostDate.
 *
 *   2. The records are created BY the admin (REST POST / addObjectEntry as the
 *      default user), so their ObjectEntry.userId is the admin. The forums-hero
 *      leaderboard renders stats.creator, so every poster shows as the admin
 *      ("Test Test"). The hero is public and guests can read forumstatsusers but
 *      NOT user-accounts, so the member identity must live on the record itself.
 *      This script reassigns each record's userId/userName to the member named by
 *      statsUserId (mirrors _02_reassign-authors' ObjectEntry rewrite).
 *
 *   3. Duplicate records. _01's "already registered?" check filters with
 *      statsUserId eq '<id>' (quoted), which is a BAD_REQUEST for an Integer
 *      field, so the check silently failed and every run re-created entries.
 *      Combined with _04 this left 3 rows per member (inflating PARTICIPANTS).
 *      This script keeps the oldest row per statsUserId and deletes the rest.
 *
 * messageCount / lastPostDate are written through ObjectEntryLocalService so the
 * search index is updated (the hero sorts messageCount:desc, which is
 * index-backed). The creator reassignment is a direct ObjectEntry SQL update
 * followed by a cache clear -- the REST layer builds `creator` from the DB row's
 * userId, not from the index, so no reindex is needed for the name to appear.
 *
 * Run in: Control Panel -> Server Administration -> Script (language: Groovy).
 * Idempotent: rerunning recomputes the same counts and finds nothing to dedupe.
 *
 * Optional: list screen names in EXCLUDE_SCREEN_NAMES (e.g. the admin "test") to
 * drop their stats records, so the demo leaderboard shows only named community
 * members. Empty by default -- it deletes real data (the admin genuinely authored
 * the messages that _02_reassign-authors did not reassign, because messages.json
 * only covers half the threads), so populate it deliberately.
 */

import com.liferay.object.model.ObjectEntry
import com.liferay.object.service.ObjectDefinitionLocalServiceUtil
import com.liferay.object.service.ObjectEntryLocalServiceUtil
import com.liferay.portal.kernel.dao.jdbc.DataAccess
import com.liferay.portal.kernel.dao.orm.EntityCacheUtil
import com.liferay.portal.kernel.dao.orm.FinderCacheUtil
import com.liferay.portal.kernel.dao.orm.ProjectionFactoryUtil
import com.liferay.portal.kernel.dao.orm.ProjectionList
import com.liferay.portal.kernel.dao.orm.RestrictionsFactoryUtil
import com.liferay.portal.kernel.model.User
import com.liferay.portal.kernel.service.ServiceContext
import com.liferay.portal.kernel.service.UserLocalServiceUtil
import com.liferay.portal.kernel.util.PortalUtil

Set<String> EXCLUDE_SCREEN_NAMES = new HashSet<>()

def companyId = PortalUtil.getDefaultCompanyId()

def statsDef = ObjectDefinitionLocalServiceUtil.fetchObjectDefinitionByExternalReferenceCode(
	"FORUM-STATS-USER", companyId)
def messageDef = ObjectDefinitionLocalServiceUtil.fetchObjectDefinitionByExternalReferenceCode(
	"FORUM-MESSAGE", companyId)

if ((statsDef == null) || (messageDef == null)) {
	out.println("ERROR: Missing object definitions (FORUM-STATS-USER=${statsDef}, FORUM-MESSAGE=${messageDef}). Aborting.")
	return
}

Set<Long> excludedUserIds = new HashSet<>()

EXCLUDE_SCREEN_NAMES.each { screenName ->
	User excludedUser = UserLocalServiceUtil.fetchUserByScreenName(companyId, screenName)

	if (excludedUser != null) {
		excludedUserIds.add(excludedUser.getUserId())
	}
	else {
		out.println("  WARN: EXCLUDE_SCREEN_NAMES user not found: ${screenName}")
	}
}

// ── 1. Aggregate ForumMessage entries per author ────────────────────────────
// ObjectEntry.userId is the author (set by _02_reassign-authors) and createDate
// is the historical post date (set by _03_backfill-create-dates).

def aggregateQuery = ObjectEntryLocalServiceUtil.dynamicQuery()
aggregateQuery.add(RestrictionsFactoryUtil.eq("objectDefinitionId", messageDef.getObjectDefinitionId()))

ProjectionList projectionList = ProjectionFactoryUtil.projectionList()
projectionList.add(ProjectionFactoryUtil.groupProperty("userId"))
projectionList.add(ProjectionFactoryUtil.rowCount())
projectionList.add(ProjectionFactoryUtil.max("createDate"))
aggregateQuery.setProjection(projectionList)

Map<Long, Integer> messageCounts = new HashMap<>()
Map<Long, Date> lastPostDates = new HashMap<>()

ObjectEntryLocalServiceUtil.dynamicQuery(aggregateQuery).each { row ->
	long userId = ((Number)row[0]).longValue()
	messageCounts.put(userId, ((Number)row[1]).intValue())
	lastPostDates.put(userId, (Date)row[2])
}

out.println("Aggregated post counts for ${messageCounts.size()} authors.")

// ── 2. Group the ForumStatsUser records by statsUserId ──────────────────────

def statsQuery = ObjectEntryLocalServiceUtil.dynamicQuery()
statsQuery.add(RestrictionsFactoryUtil.eq("objectDefinitionId", statsDef.getObjectDefinitionId()))

List<ObjectEntry> statsEntries = ObjectEntryLocalServiceUtil.dynamicQuery(statsQuery)

Map<Long, List<ObjectEntry>> entriesByStatsUserId = new LinkedHashMap<>()

statsEntries.each { statsEntry ->
	def values = ObjectEntryLocalServiceUtil.getValues(statsEntry.getObjectEntryId())
	def rawStatsUserId = values.get("statsUserId")

	if (rawStatsUserId == null) {
		out.println("  WARN: entry ${statsEntry.getObjectEntryId()} has no statsUserId; skipping.")
		return
	}

	long statsUserId = ((Number)rawStatsUserId).longValue()

	entriesByStatsUserId.computeIfAbsent(statsUserId, { k -> new ArrayList<>() }).add(statsEntry)
}

out.println("Found ${statsEntries.size()} stats records across ${entriesByStatsUserId.size()} distinct members.")

// ── 3. Dedupe, fill counts/dates on the survivor, reassign creator ──────────
// Collect the userId/userName reassignments and apply them via SQL after the
// service updates (so updateObjectEntry does not persist the stale cached
// userId back over the reassignment).

Map<Long, Long> reassignUserIdByEntryId = new LinkedHashMap<>()
Map<Long, String> reassignUserNameByEntryId = new LinkedHashMap<>()

int filled = 0
int deleted = 0
int errors = 0

entriesByStatsUserId.each { statsUserId, entries ->
	try {
		User member = UserLocalServiceUtil.fetchUser(statsUserId)

		if (excludedUserIds.contains(statsUserId)) {
			entries.each { ObjectEntryLocalServiceUtil.deleteObjectEntry(it.getObjectEntryId()); deleted++ }
			return
		}

		// Keep the oldest record (smallest objectEntryId), delete the rest.
		entries.sort { a, b -> Long.compare(a.getObjectEntryId(), b.getObjectEntryId()) }

		ObjectEntry survivor = entries.remove(0)
		entries.each { ObjectEntryLocalServiceUtil.deleteObjectEntry(it.getObjectEntryId()); deleted++ }

		int count = messageCounts.getOrDefault(statsUserId, 0)
		Date lastPostDate = lastPostDates.get(statsUserId)

		// Non-partial update fills defaults for any field not supplied, so the
		// full field set (statsUserId + messageCount + lastPostDate) is passed.
		Map<String, Serializable> values = new HashMap<>()
		values.put("statsUserId", (Long)statsUserId)
		values.put("messageCount", (Integer)count)

		if (lastPostDate != null) {
			values.put("lastPostDate", lastPostDate)
		}

		ServiceContext serviceContext = new ServiceContext()
		serviceContext.setCompanyId(companyId)
		serviceContext.setScopeGroupId(survivor.getGroupId())

		// updateObjectEntry reindexes, so messageCount:desc sorting works. The
		// acting userId here only sets statusByUser*, not the creator.
		ObjectEntryLocalServiceUtil.updateObjectEntry(
			survivor.getUserId(), survivor.getObjectEntryId(), 0L, values, serviceContext)

		filled++

		if ((member != null) && (survivor.getUserId() != statsUserId)) {
			reassignUserIdByEntryId.put(survivor.getObjectEntryId(), statsUserId)
			reassignUserNameByEntryId.put(survivor.getObjectEntryId(), member.getFullName())
		}
		else if (member == null) {
			out.println("  WARN: no User for statsUserId ${statsUserId}; left creator unchanged on entry ${survivor.getObjectEntryId()}.")
		}
	}
	catch (Exception exception) {
		errors++
		out.println("  ERROR for statsUserId ${statsUserId}: ${exception.getMessage()}")
	}
}

// ── 4. Reassign creator on the shared ObjectEntry table ─────────────────────

if (!reassignUserIdByEntryId.isEmpty()) {
	def connection = DataAccess.getConnection()

	try {
		def preparedStatement = connection.prepareStatement(
			"UPDATE ObjectEntry SET userId = ?, userName = ? WHERE objectEntryId = ?")

		reassignUserIdByEntryId.each { entryId, memberUserId ->
			preparedStatement.setLong(1, memberUserId)
			preparedStatement.setString(2, reassignUserNameByEntryId.get(entryId))
			preparedStatement.setLong(3, entryId)
			preparedStatement.addBatch()
		}

		preparedStatement.executeBatch()
		preparedStatement.close()
	}
	finally {
		connection.close()
	}

	// Direct ObjectEntry writes bypass the entity cache; clear it so the REST
	// layer resolves `creator` from the reassigned userId.
	EntityCacheUtil.clearCache()
	FinderCacheUtil.clearCache()
}

out.println("Done. Filled: ${filled}  Reassigned creators: ${reassignUserIdByEntryId.size()}  Deleted duplicates: ${deleted}  Errors: ${errors}")
