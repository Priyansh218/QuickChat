
const express = require("express");
const store = require("../store");
const authenticate = require("../middleware/auth");

const router = express.Router();

// GET GROUP MESSAGES
router.get("/:groupId/messages", authenticate, (req, res) => {
  const groupId = req.params.groupId;
  const membership = store.getMembership(groupId, req.user.id);

  if (!store.getGroup(groupId) || !membership) {
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

  const messages = store.getMessages(groupId, limit, before);

  res.json({
    success: true,
    messages
  });
});

// SEND MESSAGE
router.post("/:groupId/messages", authenticate, (req, res) => {
  const groupId = req.params.groupId;
  const membership = store.getMembership(groupId, req.user.id);

  if (!store.getGroup(groupId) || !membership) {
    return res.status(404).json({
      success: false,
      message: "Group not found."
    });
  }

  const { text } = req.body;

  if (typeof text !== "string" || !text.trim() || text.trim().length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Message must contain between 1 and 2000 characters."
    });
  }

  const user = store.getUserById(req.user.id);

  const message = store.addMessage({
    groupId,
    senderId: user.id,
    senderName: user.fullName,
    text: text.trim()
  });

  res.status(201).json({
    success: true,
    message
  });
});



// DELETE OWN MESSAGE
router.delete("/:groupId/messages/:messageId", authenticate, (req, res) => {
  const { groupId, messageId } = req.params;

  // Verify group membership
  const membership = store.getMembership(groupId, req.user.id);

  if (!store.getGroup(groupId) || !membership) {
    return res.status(404).json({
      success: false,
      message: "Group not found."
    });
  }

  // Find the requested message
  const message = store.getMessage(groupId, messageId);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: "Message not found."
    });
  }

  // Only the sender can delete their message
  if (message.senderId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "You can only delete your own messages."
    });
  }

  // Delete and persist
  const deleted = store.deleteMessage(groupId, messageId);

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
});




module.exports = router;
