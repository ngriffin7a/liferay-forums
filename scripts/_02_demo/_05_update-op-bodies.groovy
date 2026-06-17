/* Update the body_ of each OP reply (first ForumReply per message,
 * subject == messageTitle) so the workspace messages.json is the source
 * of truth for the post content. Useful after expanding bodies/adding
 * images in JSON without re-running the full Python script (which would
 * skip existing messages anyway thanks to idempotency).
 *
 * Idempotent: rerunning overwrites with the same content.
 */

import com.liferay.portal.kernel.dao.jdbc.DataAccess
import groovy.json.JsonSlurper

def dataPath = "/Users/davidaragones/Projects/liferay-forums-neil/scripts/_02_demo/data"
def messages = new JsonSlurper().parse(new File("$dataPath/messages.json"))

def conn = DataAccess.getConnection()

def updated = 0
def missing = 0

messages.each { msg ->
	def title = msg.title
	def body = msg.body

	def findMsg = conn.prepareStatement(
		"SELECT c_forumMessageId_ FROM O_67814666107392_ForumMessage_l WHERE messageTitle_ = ? AND languageId = 'en_US'")
	findMsg.setString(1, title)
	def rs = findMsg.executeQuery()
	Long msgId = null
	if (rs.next()) msgId = rs.getLong(1)
	rs.close()
	findMsg.close()

	if (msgId == null) {
		out.println("  WARN: Message not found: " + title)
		missing++
		return
	}

	def findOpReply = conn.prepareStatement(
		"SELECT fr.c_forumReplyId_ FROM O_67814666107392_ForumReply fr " +
		"JOIN O_67814666107392_ForumReply_l frl ON frl.c_forumReplyId_ = fr.c_forumReplyId_ AND frl.languageId = 'en_US' " +
		"WHERE fr.r_messageReplies_c_forumMessageId = ? AND frl.subject_ = ?")
	findOpReply.setLong(1, msgId)
	findOpReply.setString(2, title)
	def rs2 = findOpReply.executeQuery()
	Long opReplyId = null
	if (rs2.next()) opReplyId = rs2.getLong(1)
	rs2.close()
	findOpReply.close()

	if (opReplyId == null) {
		out.println("  WARN: OP reply not found for: " + title)
		missing++
		return
	}

	def upd = conn.prepareStatement(
		"UPDATE O_67814666107392_ForumReply SET body_ = ? WHERE c_forumReplyId_ = ?")
	upd.setString(1, body)
	upd.setLong(2, opReplyId)
	upd.executeUpdate()
	upd.close()
	updated++
}

conn.close()

out.println("Done: " + updated + " OP bodies updated (" + missing + " not found)")
