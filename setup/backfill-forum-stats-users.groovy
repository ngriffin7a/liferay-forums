/**
 * Backfills ForumStatsUser records for users who posted before the auto-creation
 * logic existed, or after a data import where those records were not included.
 * Fixes the forums-hero fragment showing 0 Members in those scenarios.
 *
 * Run this script in:
 *   Control Panel → Server Administration → Script (Groovy)
 *
 * IMPORTANT: Before running, delete all existing ForumStatsUser entries via
 *   setup/delete-forum-stats-users.py (or the Liferay UI) to avoid duplicates.
 */

import com.liferay.object.service.ObjectDefinitionLocalServiceUtil
import com.liferay.object.service.ObjectEntryLocalServiceUtil
import com.liferay.portal.kernel.service.ServiceContext
import com.liferay.portal.kernel.dao.orm.RestrictionsFactoryUtil
import com.liferay.portal.kernel.dao.orm.ProjectionFactoryUtil
import com.liferay.portal.kernel.util.LocaleUtil

def companyId = com.liferay.portal.kernel.util.PortalUtil.getDefaultCompanyId()

def statsUserDef = ObjectDefinitionLocalServiceUtil.getObjectDefinitionByExternalReferenceCode("FORUM-STATS-USER", companyId)
def threadDef = ObjectDefinitionLocalServiceUtil.getObjectDefinitionByExternalReferenceCode("FORUM-THREAD", companyId)
def replyDef = ObjectDefinitionLocalServiceUtil.getObjectDefinitionByExternalReferenceCode("FORUM-REPLY", companyId)

if (!statsUserDef || !threadDef || !replyDef) {
    out.println("❌ Could not find Forum Object Definitions. Ensure FORUM-STATS-USER, FORUM-THREAD, and FORUM-REPLY exist.")
    return
}

out.println("Fetching unique user IDs from threads and replies...")

// Use projections — avoids loading full ObjectEntry objects into memory.
def collectUserIds = { long defId ->
    def q = ObjectEntryLocalServiceUtil.dynamicQuery()
    q.add(RestrictionsFactoryUtil.eq("objectDefinitionId", defId))
    q.setProjection(ProjectionFactoryUtil.distinct(ProjectionFactoryUtil.property("userId")))
    ObjectEntryLocalServiceUtil.dynamicQuery(q)
}

Set<Long> uniqueUserIds = new HashSet<>()
collectUserIds(threadDef.getObjectDefinitionId()).each { uniqueUserIds.add(((Number)it).longValue()) }
collectUserIds(replyDef.getObjectDefinitionId()).each { uniqueUserIds.add(((Number)it).longValue()) }

out.println("Found " + uniqueUserIds.size() + " unique users who have posted.")

// Resolve the site groupId via projection.
def resolveGroupId = { long defId ->
    def q = ObjectEntryLocalServiceUtil.dynamicQuery()
    q.add(RestrictionsFactoryUtil.eq("objectDefinitionId", defId))
    q.setProjection(ProjectionFactoryUtil.property("groupId"))
    def rows = ObjectEntryLocalServiceUtil.dynamicQuery(q, 0, 1)
    rows.size() > 0 ? ((Number)rows.get(0)).longValue() : 0L
}

long groupId = resolveGroupId(statsUserDef.getObjectDefinitionId())
if (groupId == 0) groupId = resolveGroupId(threadDef.getObjectDefinitionId())
if (groupId == 0) groupId = resolveGroupId(replyDef.getObjectDefinitionId())

if (groupId == 0) {
    out.println("❌ Could not determine site groupId. Aborting.")
    return
}

out.println("Using groupId: " + groupId)

// Use the default user as technical creator — avoids per-user site-membership validation.
// The actual forum member is stored in the statsUserId field.
def creatorUserId = com.liferay.portal.kernel.service.UserLocalServiceUtil.getDefaultUserId(companyId)
def defaultLanguageId = LocaleUtil.toLanguageId(LocaleUtil.getDefault())

def sc = new ServiceContext()
sc.setCompanyId(companyId)
sc.setScopeGroupId(groupId)

int added = 0
int errors = 0

uniqueUserIds.each { userId ->
    try {
        Map<String, java.io.Serializable> values = new HashMap<>()
        values.put("statsUserId", userId)

        ObjectEntryLocalServiceUtil.addObjectEntry(
            groupId,
            creatorUserId,
            statsUserDef.getObjectDefinitionId(),
            0L,
            defaultLanguageId,
            values,
            sc
        )
        added++
    } catch (Exception e) {
        errors++
        out.println(" ❌ Error for userId: " + userId + " - " + e.getMessage())
    }
}

out.println("Done. Added: " + added + "  Errors: " + errors)
