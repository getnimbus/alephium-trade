import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "@services/redis";
import { setupSwagger } from "@configs/swagger";
import { getTokenPriceHandler } from "@controllers/price";
import cors from "cors";
import logger from "@utils/logger";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
const port = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT = 10_000; // 10 seconds

app.set("trust proxy", 1);

// Middleware
const limiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 100, // Limit each IP to 100 requests per `window` (here, per 1 minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: "Too many requests. Please wait for a moment.",
  },
  // Redis store configuration
  store: new RedisStore({
    // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
    sendCommand: (...args: string[]) =>
      getRedisClient().then((client) => client.call(...args)),
  }),
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(limiter);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// Setup Swagger
setupSwagger(app);

// Routes
app.get("/api/prices", getTokenPriceHandler);

// Start server
const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Swagger docs available at http://localhost:${port}/api-docs`);
});

// Graceful shutdown
const signals = ["SIGTERM", "SIGINT"] as const;

const gracefulShutdown = async (signal: (typeof signals)[number]) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Set a timeout to force exit if graceful shutdown takes too long
  const timeout = setTimeout(() => {
    console.error("Graceful shutdown timeout reached. Forcing exit...");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Close the server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    clearTimeout(timeout);
    console.log("Server closed successfully");
    process.exit(0);
  } catch (err) {
    clearTimeout(timeout);
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

// Register signal handlers
signals.forEach((signal) => {
  process.on(signal, () => {
    gracefulShutdown(signal);
  });
});
