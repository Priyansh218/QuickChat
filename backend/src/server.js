require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const groupRoutes = require("./routes/groups");
const messageRoutes = require("./routes/messages");

const app = express();

// Running behind Nginx, so trust the first proxy hop for the real client IP
app.set("trust proxy", 2);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Request logging (written to the service log, shipped to CloudWatch Logs).
// Successful GET requests are skipped because the frontend polls every few seconds.
app.use(morgan(":remote-addr :method :url :status :response-time ms", {
  skip: (req, res) => req.method === "GET" && res.statusCode < 400
}));

// Brute-force protection for login and registration only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes."
  }
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

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