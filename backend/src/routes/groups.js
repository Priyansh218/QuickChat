
const express = require("express");
const store = require("../store");
const authenticate = require("../middleware/auth");

const router = express.Router();

// GROUP MEMBER MIDDLEWARE
async function requireGroupMember(req, res, next) {
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

    req.group = group;
    req.membership = membership;

    next();
  } catch (error) {
    next(error);
  }
}

// CREATE GROUP
router.post("/", authenticate, async (req, res) => {
  try {
    const { name, description = "", memberIds = [] } = req.body;

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

    const users = await Promise.all(
      uniqueIds.map(id => store.getUserById(id))
    );

    if (users.some(user => !user)) {
      return res.status(400).json({
        success: false,
        message: "One or more selected users do not exist."
      });
    }

    const group = await store.createGroup({
      name: name.trim(),
      description: description.trim(),
      creatorId: req.user.id,
      memberIds: uniqueIds
    });

    const members = await store.getGroupMembers(group.id);

    return res.status(201).json({
      success: true,
      message: "Group created successfully.",
      group,
      members
    });
  } catch (error) {
    console.error("Create group error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create group."
    });
  }
});

// LIST MY GROUPS
router.get("/", authenticate, async (req, res) => {
  try {
    const groups = await store.getUserGroups(req.user.id);

    return res.json({
      success: true,
      groups
    });
  } catch (error) {
    console.error("List groups error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve groups."
    });
  }
});

// GROUP DETAILS
router.get("/:groupId", authenticate, requireGroupMember, async (req, res) => {
  try {
    const members = await store.getGroupMembers(req.params.groupId);

    return res.json({
      success: true,
      group: req.group,
      members
    });
  } catch (error) {
    console.error("Group details error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve group details."
    });
  }
});

// UPDATE GROUP DETAILS (ADMIN ONLY)
router.patch("/:groupId", authenticate, requireGroupMember, async (req, res) => {
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
    const updatedGroup = await store.updateGroup(req.params.groupId, {
      name: name.trim(),
      description: description.trim()
    });

    return res.json({
      success: true,
      message: "Group details updated successfully.",
      group: updatedGroup
    });
  } catch (error) {
    console.error("Update group error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not update group details."
    });
  }
});

// ADD MEMBER (ADMIN ONLY)
router.post("/:groupId/members", authenticate, requireGroupMember, async (req, res) => {
  if (req.membership.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only the group admin can add members."
    });
  }

  try {
    const { username } = req.body;

    if (typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: "Username is required."
      });
    }

    const user = await store.getUserByUsername(username.trim());

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    await store.addMember(req.params.groupId, user.id);

    return res.status(201).json({
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

    console.error("Add member error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not add member."
    });
  }
});

// REMOVE MEMBER (ADMIN ONLY)
router.delete("/:groupId/members/:userId", authenticate, requireGroupMember, async (req, res) => {
  if (req.membership.role !== "admin") {
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

  try {
    const membership = await store.getMembership(
      req.params.groupId,
      req.params.userId
    );

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Member not found."
      });
    }

    await store.removeMember(req.params.groupId, req.params.userId);

    return res.json({
      success: true,
      message: "Member removed successfully."
    });
  } catch (error) {
    console.error("Remove member error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not remove member."
    });
  }
});

// TRANSFER ADMIN
router.patch("/:groupId/admin", authenticate, requireGroupMember, async (req, res) => {
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
    await store.transferAdmin(
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

    console.error("Transfer admin error:", error);

    return res.status(400).json({
      success: false,
      message: "Could not transfer admin rights."
    });
  }
});

// LEAVE GROUP (NON-ADMIN)
router.post("/:groupId/leave", authenticate, requireGroupMember, async (req, res) => {
  if (req.membership.role === "admin") {
    return res.status(400).json({
      success: false,
      message: "Transfer admin rights before leaving the group."
    });
  }

  try {
    await store.removeMember(req.params.groupId, req.user.id);

    return res.json({
      success: true,
      message: "You left the group."
    });
  } catch (error) {
    console.error("Leave group error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not leave group."
    });
  }
});

// DELETE GROUP (ADMIN ONLY)
router.delete("/:groupId", authenticate, requireGroupMember, async (req, res) => {
  if (req.membership.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only the group admin can delete the group."
    });
  }

  try {
    await store.deleteGroup(req.params.groupId);

    return res.json({
      success: true,
      message: "Group deleted successfully."
    });
  } catch (error) {
    console.error("Delete group error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not delete group."
    });
  }
});

module.exports = router;
