const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const dns = require("dns");
const authRoutes = require("./routes/auth");
const noteRoutes = require("./routes/notes");
const flashcardRoutes = require("./routes/flashcards");
const quizRoutes = require("./routes/quiz");
const workspaceRoutes = require("./routes/workspace");
require("./models/Chunk");
require("./models/ChatSession");

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:3000"
).split(",");
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // prevent giant JSON payloads
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ── NoSQL injection sanitisation ─────────────────────────────────────────────
app.use(mongoSanitize());

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── HTTP request logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ── Global rate limiter (all routes) ─────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", globalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/workspace", workspaceRoutes);

app.get("/", (req, res) =>
  res.json({ message: "StudyOS API running", env: process.env.NODE_ENV }),
);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);
  const status = err.statusCode || err.status || 500;
  // Never expose stack traces in production
  res.status(status).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message,
  });
});

// ── DB + server startup ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✓ MongoDB connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () =>
      console.log(
        `✓ Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`,
      ),
    );
  })
  .catch((err) => {
    console.error("✗ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — closing server gracefully");
  await mongoose.connection.close();
  process.exit(0);
});
