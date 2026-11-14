
const express = require("express");
const store = require("../store");
const authenticate = require("../middleware/auth");

const router = express.Router();

function isAdmin(groupId, userId) {
  const membership = store.getMembership(groupId, userId);
  return membership && membership.role === "admin";
}

function requireGroupMember(req, res, next) {
  const group = store.getGroup(req.params.groupId);
  const membership = store.getMembership(req.params.groupId, req.user.id);

  if (!group || !membership) {
    return res.status(404).json({
      success: false,
      message: "Group not found."
    });
  }

  req.group = group;
  req.membership = membership;
  next();
}

// CREATE GROUP
router.post("/", authenticate, (req, res) => {
  const { name, description = "", memberIds = [] } = req.body;

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
    return res.status(400).json({
      success: false,
      message: "Group name must be between 2 and 50 characters."
    });
  }

  if (typeof description !== "string" || description.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Description must be 200 characters or fewer."
    });
  }

  if (!Array.isArray(memberIds) || memberIds.length > 49) {
    return res.status(400).json({
      success: false,
      message: "You can add up to 49 other members."
    });
  }

  const uniqueIds = [...new Set(memberIds)];

  if (uniqueIds.some(id => typeof id !== "string")) {
    return res.status(400).json({
      success: false,
      message: "Invalid member list."
    });
  }

  for (const id of uniqueIds) {
    if (!store.getUserById(id)) {
      return res.status(400).json({
        success: false,
        message: "One or more selected users do not exist."
      });
    }
  }

  const group = store.createGroup({
    name: name.trim(),
    description: description.trim(),
    creatorId: req.user.id,
    memberIds: uniqueIds
  });

  res.status(201).json({
    success: true,
    message: "Group created successfully.",
    group,
    members: store.getGroupMembers(group.id)
  });
});

// LIST MY GROUPS
router.get("/", authenticate, (req, res) => {
  res.json({
    success: true,
    groups: store.getUserGroups(req.user.id)
  });
});

// GROUP DETAILS
router.get("/:groupId", authenticate, requireGroupMember, (req, res) => {
  res.json({
    success: true,
    group: req.group,
    members: store.getGroupMembers(req.params.groupId)
  });
});

// UPDATE GROUP DETAILS (ADMIN ONLY)
router.patch("/:groupId", authenticate, requireGroupMember, (req, res) => {
  if (req.membership.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only the group admin can edit group details."
    });
  }

  const { name, description = "" } = req.body;

  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 50
  ) {
    return res.status(400).json({
      success: false,
      message: "Group name must be between 2 and 50 characters."
    });
  }

  if (
    typeof description !== "string" ||
    description.trim().length > 200
  ) {
    return res.status(400).json({
      success: false,
      message: "Description must be 200 characters or fewer."
    });
  }

  try {
    const updatedGroup = store.updateGroup(req.params.groupId, {
      name: name.trim(),
      description: description.trim()
    });

    return res.json({
      success: true,
      message: "Group details updated successfully.",
      group: updatedGroup
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Could not update group details."
    });
  }
});

// ADD MEMBER (ADMIN ONLY)
router.post("/:groupId/members", authenticate, requireGroupMember, (req, res) => {
  if (!isAdmin(req.params.groupId, req.user.id)) {
    return res.status(403).json({
      success: false,
      message: "Only the group admin can add members."
    });
  }

  const { username } = req.body;

  if (typeof username !== "string" || !username.trim()) {
    return res.status(400).json({
      success: false,
      message: "Username is required."
    });
  }

  const user = store.getUserByUsername(username.trim());

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  try {
    store.addMember(req.params.groupId, user.id);

    res.status(201).json({
      success: true,
      message: "Member added successfully."
    });
  } catch (error) {
    if (error.message === "ALREADY_MEMBER") {
      return res.status(409).json({
        success: false,
        message: "This user is already a group member."
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not add member."
    });
  }
});

// REMOVE MEMBER (ADMIN ONLY)
router.delete("/:groupId/members/:userId", authenticate, requireGroupMember, (req, res) => {
  if (!isAdmin(req.params.groupId, req.user.id)) {
    return res.status(403).json({
      success: false,
      message: "Only the group admin can remove members."
    });
  }

  if (req.params.userId === req.user.id) {
    return res.status(400).json({
      success: false,
      message: "The admin cannot remove themselves. Transfer admin rights first."
    });
  }

  const membership = store.getMembership(
    req.params.groupId,
    req.params.userId
  );

  if (!membership) {
    return res.status(404).json({
      success: false,
      message: "Member not found."
    });
  }

  store.removeMember(req.params.groupId, req.params.userId);

  res.json({
    success: true,
    message: "Member removed successfully."
  });
});

// TRANSFER ADMIN (CURRENT ADMIN ONLY)
router.patch("/:groupId/admin", authenticate, requireGroupMember, (req, res) => {
  if (req.membership.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only the current group admin can transfer admin rights."
    });
  }

  const { newAdminId } = req.body;

  if (typeof newAdminId !== "string" || !newAdminId.trim()) {
    return res.status(400).json({
      success: false,
      message: "Select a member to become the new admin."
    });
  }

  try {
    store.transferAdmin(
      req.params.groupId,
      req.user.id,
      newAdminId
    );

    return res.json({
      success: true,
      message: "Admin rights transferred successfully."
    });
  } catch (error) {
    if (error.message === "TARGET_NOT_MEMBER") {
      return res.status(404).json({
        success: false,
        message: "The selected user is not a member of this group."
      });
    }

    return res.status(400).json({
      success: false,
      message: "Could not transfer admin rights."
    });
  }
});

// LEAVE GROUP (NON-ADMIN)
router.post("/:groupId/leave", authenticate, requireGroupMember, (req, res) => {
  if (req.membership.role === "admin") {
    return res.status(400).json({
      success: false,
      message: "Transfer admin rights before leaving the group."
    });
  }

  store.removeMember(req.params.groupId, req.user.id);

  res.json({
    success: true,
    message: "You left the group."
  });
});

// DELETE GROUP (ADMIN ONLY)
router.delete("/:groupId", authenticate, requireGroupMember, (req, res) => {
  if (!isAdmin(req.params.groupId, req.user.id)) {
    return res.status(403).json({
      success: false,
      message: "Only the group admin can delete the group."
    });
  }

  store.deleteGroup(req.params.groupId);

  res.json({
    success: true,
    message: "Group deleted successfully."
  });
});

module.exports = router;
