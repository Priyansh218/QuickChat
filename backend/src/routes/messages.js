
const express = require("express");
const store = require("../store");
const authenticate = require("../middleware/auth");

const router = express.Router();

// GET GROUP MESSAGES
router.get("/:groupId/messages", authenticate, async (req, res) => {
  try {
    const groupId = req.params.groupId;

    const [group, membership] = await Promise.all([
      store.getGroup(groupId),
      store.getMembership(groupId, req.user.id)
    ]);

    if (!group || !membership) {
      return res.status(404).json({
        success: false,
        message: "Group not found."
      });
    }

    const parsedLimit = Number(req.query.limit || 50);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;

    const before = req.query.before;

    const messages = await store.getMessages(groupId, limit, before);

    return res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error("Get messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve messages."
    });
  }
});

// SEND MESSAGE
router.post("/:groupId/messages", authenticate, async (req, res) => {
  try {
    const groupId = req.params.groupId;

    const [group, membership] = await Promise.all([
      store.getGroup(groupId),
      store.getMembership(groupId, req.user.id)
    ]);

    if (!group || !membership) {
      return res.status(404).json({
        success: false,
        message: "Group not found."
      });
    }

    const { text } = req.body;

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.trim().length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must contain between 1 and 2000 characters."
      });
    }

    const user = await store.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const message = await store.addMessage({
      groupId,
      senderId: user.id,
      senderName: user.fullName,
      text: text.trim()
    });

    return res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error("Send message error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not send message."
    });
  }
});

// DELETE OWN MESSAGE
router.delete("/:groupId/messages/:messageId", authenticate, async (req, res) => {
  try {
    const { groupId, messageId } = req.params;

    const [group, membership] = await Promise.all([
      store.getGroup(groupId),
      store.getMembership(groupId, req.user.id)
    ]);

    if (!group || !membership) {
      return res.status(404).json({
        success: false,
        message: "Group not found."
      });
    }

    const message = await store.getMessage(groupId, messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found."
      });
    }

    if (message.senderId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages."
      });
    }

    const deleted = await store.deleteMessage(groupId, messageId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Message not found."
      });
    }

    return res.json({
      success: true,
      message: "Message deleted successfully."
    });
  } catch (error) {
    console.error("Delete message error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not delete message."
    });
  }
});

module.exports = router;
