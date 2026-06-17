/* Reassign ForumMessage / ForumReply ObjectEntry authorship to match the
 * `author` field declared in messages.json. Runs after _01_create-demo-data.py
 * which creates everything as admin.
 *
 * Matching strategy:
 *   - ForumMessage: looked up by messageTitle (en_US).
 *   - ForumReply: ordered by createDate ASC for each message; index 0 is
 *     the OP reply (authored by the message author), index N>=1 matches
 *     msg.replies[N-1].author.
 *
 * Idempotent: rerunning just sets the same userIds again.
 */

import com.liferay.portal.kernel.dao.jdbc.DataAccess
import com.liferay.portal.kernel.service.UserLocalServiceUtil
import com.liferay.portal.kernel.util.PortalUtil
import groovy.json.JsonSlurper

def dataPath = "/Users/davidaragones/Projects/liferay-forums-neil/scripts/_02_demo/data"
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

def msgsUpdated = 0
def repliesUpdated = 0
def msgsMissing = 0

messages.each { msg ->
	def title = msg.title
	def author = msg.author

	def findMsg = conn.prepareStatement(
		"SELECT c_forumMessageId_ FROM O_67814666107392_ForumMessage_l WHERE messageTitle_ = ? AND languageId = 'en_US'")
	findMsg.setString(1, title)
	def rs = findMsg.executeQuery()
	Long msgId = null
	if (rs.next()) msgId = rs.getLong(1)
	rs.close()
	findMsg.close()

	if (msgId == null) {
		out.println("  WARN: Message not found in DB: ${title}")
		msgsMissing++
		return
	}

	def authorInfo = userMap[author]
	if (authorInfo) {
		def upd = conn.prepareStatement(
			"UPDATE ObjectEntry SET userId = ?, userName = ? WHERE objectEntryId = ?")
		upd.setLong(1, authorInfo.userId)
		upd.setString(2, authorInfo.fullName)
		upd.setLong(3, msgId)
		upd.executeUpdate()
		upd.close()
		msgsUpdated++
	}

	def findReplies = conn.prepareStatement(
		"SELECT fr.c_forumReplyId_ FROM O_67814666107392_ForumReply fr " +
		"JOIN ObjectEntry oe ON oe.objectEntryId = fr.c_forumReplyId_ " +
		"WHERE fr.r_messageReplies_c_forumMessageId = ? ORDER BY oe.createDate ASC")
	findReplies.setLong(1, msgId)
	def rs2 = findReplies.executeQuery()

	def replyIds = []
	while (rs2.next()) {
		replyIds << rs2.getLong(1)
	}
	rs2.close()
	findReplies.close()

	def updReply = conn.prepareStatement(
		"UPDATE ObjectEntry SET userId = ?, userName = ? WHERE objectEntryId = ?")

	replyIds.eachWithIndex { replyId, idx ->
		def replyAuthor = null
		if (idx == 0) {
			replyAuthor = author
		} else if ((idx - 1) < msg.replies.size()) {
			replyAuthor = msg.replies[idx - 1].author
		}

		if (replyAuthor && userMap[replyAuthor]) {
			def info = userMap[replyAuthor]
			updReply.setLong(1, info.userId)
			updReply.setString(2, info.fullName)
			updReply.setLong(3, replyId)
			updReply.executeUpdate()
			repliesUpdated++
		}
	}
	updReply.close()
}

conn.close()

out.println("Done: ${msgsUpdated} messages and ${repliesUpdated} replies reassigned (${msgsMissing} messages missing in DB)")
