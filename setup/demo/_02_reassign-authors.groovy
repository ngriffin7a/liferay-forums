/* Reassign ForumThread / ForumMessage ObjectEntry authorship to match the
 * `author` field declared in messages.json. Runs after _01_create-demo-data.py
 * which creates everything as admin.
 *
 * Matching strategy:
 *   - ForumThread:  looked up by messageTitle (en_US).
 *   - ForumMessage: ordered by createDate ASC for each thread; index 0 is the
 *     OP message (authored by the thread author), index N>=1 matches
 *     msg.replies[N-1].author.
 *
 * Entry-table names are resolved at runtime from ObjectDefinition.dbTableName
 * so nothing is hardcoded to a specific environment (company id and object
 * definition ids differ per instance and change on re-provisioning). To sanity
 * check what those resolve to, run in your SQL client:
 *     SELECT name, dbTableName FROM ObjectDefinition WHERE name LIKE 'C_Forum%';
 *
 * Idempotent: rerunning just sets the same userIds again.
 */

import com.liferay.portal.kernel.dao.jdbc.DataAccess
import com.liferay.portal.kernel.service.UserLocalServiceUtil
import com.liferay.portal.kernel.util.PortalUtil
import groovy.json.JsonSlurper

// Path to the demo data, on the SERVER filesystem (the Script console reads
// from the server process, not your host). In Docker, the workspace `files`
// folder is bind-mounted to /mnt/liferay/files, so drop the data there:
//     cp -R setup/demo/data <workspace.home>/files/forums-demo/data
// On a bare local dev box, point this at your Assets checkout instead, e.g.
//     System.getProperty("user.home") + "/Assets/liferay-forums/setup/demo/data"
def dataPath = "/mnt/liferay/files/forums-demo/data"
def messages = new JsonSlurper().parse(new File("$dataPath/messages.json"))
def usersJson = new JsonSlurper().parse(new File("$dataPath/users.json"))

def companyId = PortalUtil.getDefaultCompanyId()

def userMap = [:]
usersJson.each { u ->
	def user = UserLocalServiceUtil.fetchUserByScreenName(companyId, u.screenName)
	if (user != null) {
		userMap[u.screenName] = [
			userId: user.userId,
			fullName: "${u.givenName} ${u.familyName}".toString()
		]
	} else {
		out.println("  WARN: User not found by screenName: ${u.screenName}")
	}
}
out.println("Loaded ${userMap.size()} demo users")

def conn = DataAccess.getConnection()

/* Resolve the entry-table name for an object definition from the DB so the
 * O_<companyId>_<Name> prefix is never hardcoded. */
def resolveTable = { defName ->
	def ps = conn.prepareStatement("SELECT dbTableName FROM ObjectDefinition WHERE name = ?")
	ps.setString(1, defName)
	def r = ps.executeQuery()
	def t = r.next() ? r.getString(1) : null
	r.close()
	ps.close()
	return t
}

def threadTable = resolveTable("C_ForumThread")
def messageTable = resolveTable("C_ForumMessage")

if (threadTable == null || messageTable == null) {
	out.println("ERROR: Could not resolve object tables (threadTable=${threadTable}, messageTable=${messageTable}). Aborting.")
	conn.close()
	return
}

def threadLocalizedTable = threadTable + "_l"

def msgsUpdated = 0
def repliesUpdated = 0
def msgsMissing = 0

messages.each { msg ->
	def title = msg.title
	def author = msg.author

	def findThread = conn.prepareStatement(
		("SELECT c_forumThreadId_ FROM ${threadLocalizedTable} " +
		"WHERE messageTitle_ = ? AND languageId = 'en_US'").toString())
	findThread.setString(1, title)
	def rs = findThread.executeQuery()
	Long threadId = null
	if (rs.next()) threadId = rs.getLong(1)
	rs.close()
	findThread.close()

	if (threadId == null) {
		out.println("  WARN: Thread not found in DB: ${title}")
		msgsMissing++
		return
	}

	def authorInfo = userMap[author]
	if (authorInfo) {
		def upd = conn.prepareStatement(
			"UPDATE ObjectEntry SET userId = ?, userName = ? WHERE objectEntryId = ?")
		upd.setLong(1, authorInfo.userId)
		upd.setString(2, authorInfo.fullName)
		upd.setLong(3, threadId)
		upd.executeUpdate()
		upd.close()
		msgsUpdated++
	}

	def findMessages = conn.prepareStatement(
		("SELECT fm.c_forumMessageId_ FROM ${messageTable} fm " +
		"JOIN ObjectEntry oe ON oe.objectEntryId = fm.c_forumMessageId_ " +
		"WHERE fm.r_threadMessages_c_forumThreadId = ? ORDER BY oe.createDate ASC").toString())
	findMessages.setLong(1, threadId)
	def rs2 = findMessages.executeQuery()

	def messageIds = []
	while (rs2.next()) {
		messageIds << rs2.getLong(1)
	}
	rs2.close()
	findMessages.close()

	def updMessage = conn.prepareStatement(
		"UPDATE ObjectEntry SET userId = ?, userName = ? WHERE objectEntryId = ?")

	messageIds.eachWithIndex { messageId, idx ->
		def replyAuthor = null
		if (idx == 0) {
			replyAuthor = author
		} else if ((idx - 1) < msg.replies.size()) {
			replyAuthor = msg.replies[idx - 1].author
		}

		if (replyAuthor && userMap[replyAuthor]) {
			def info = userMap[replyAuthor]
			updMessage.setLong(1, info.userId)
			updMessage.setString(2, info.fullName)
			updMessage.setLong(3, messageId)
			updMessage.executeUpdate()
			repliesUpdated++
		}
	}
	updMessage.close()
}

conn.close()

out.println("Done: ${msgsUpdated} threads and ${repliesUpdated} messages reassigned (${msgsMissing} threads missing in DB)")
