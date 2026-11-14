
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const groupRoutes = require("./routes/groups");
const messageRoutes = require("./routes/messages");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "100kb" }));

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "QuickChat backend is running.",
    storage: process.env.STORAGE_MODE || "memory"
  });
});

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/groups", messageRoutes);

// UNKNOWN ROUTE
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found."
  });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error."
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("--------------------------------");
  console.log("QuickChat Backend Started");
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Storage: ${process.env.STORAGE_MODE || "memory"}`);
  console.log("--------------------------------");
});
