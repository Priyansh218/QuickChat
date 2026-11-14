
const express = require("express");
const store = require("../store");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.get("/search", authenticate, (req, res) => {
  const username = req.query.username;

  if (typeof username !== "string" || username.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: "Enter at least 2 characters to search."
    });
  }

  const users = store.searchUsers(username, req.user.id);

  res.json({
    success: true,
    users
  });
});

module.exports = router;
