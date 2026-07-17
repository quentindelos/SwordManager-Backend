if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { sequelize } = require("./models");

const app = express();

// Trust exactly one hop (the Cloud Run front-end proxy) so req.ip reflects the real client
// IP. Trusting *all* hops (`true`) lets a client spoof X-Forwarded-For and defeats
// express-rate-limit's per-IP limiting, which is why it refuses to start with that setting.
app.set("trust proxy", 1);

// Global HTTP security headers
app.use(helmet());

// Dynamic cross-origin resource sharing (CORS) configuration
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://www.swordmanager.cloud", "https://swordmanager.cloud"]
    : ["http://localhost:5500", "http://127.0.0.1:5500"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json());

// Global rate limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// API route registrations
app.use("/auth", require("./routes/authRoutes"));
app.use("/vault", require("./routes/vaultRoutes"));
app.use("/activity", require("./routes/activityRoutes"));

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Application startup logic
const start = async () => {
  try {
    // Verify database connectivity
    await sequelize.authenticate();
    console.log("📦 Database connection established successfully.");

    // Synchronize models
    await sequelize.sync({ alter: true });

    const port = process.env.PORT || 8080;
    app.listen(port, "0.0.0.0", () => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`🚀 Server ready on port ${port}`);
      }
    });
  } catch (e) {
    console.error("💥 Failed to start server:", e);
    process.exit(1);
  }
};

start();
