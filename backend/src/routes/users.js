
const express = require("express");
const store = require("../store");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.get("/search", authenticate, async (req, res) => {
  try {
    const username = req.query.username;

    if (typeof username !== "string" || username.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Enter at least 2 characters to search."
      });
    }

    const users = await store.searchUsers(username, req.user.id);

    return res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error("User search error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not search users."
    });
  }
});

module.exports = router;
