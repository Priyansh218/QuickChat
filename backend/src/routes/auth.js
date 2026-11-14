
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const store = require("../store");
const authenticate = require("../middleware/auth");

const router = express.Router();

function safeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username
  };
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { fullName, username, password } = req.body;

    if (
      typeof fullName !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid registration details."
      });
    }

    const cleanName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 60) {
      return res.status(400).json({
        success: false,
        message: "Full name must be between 2 and 60 characters."
      });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-20 characters and contain only letters, numbers or underscores."
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 72 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = store.createUser({
      fullName: cleanName,
      username: cleanUsername,
      passwordHash
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: safeUser(user)
    });
  } catch (error) {
    if (error.message === "USERNAME_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "Username is already taken."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    const user = store.getUserByUsername(username.trim());

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: "Incorrect username or password."
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: safeUser(user)
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
});

// CURRENT USER
router.get("/me", authenticate, (req, res) => {
  const user = store.getUserById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  res.json({
    success: true,
    user: safeUser(user)
  });
});

module.exports = router;
