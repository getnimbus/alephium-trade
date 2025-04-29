import express from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "@services/redis";
import { getTokenPriceHandler } from "@controllers/price";
import { swaggerSpec } from "@configs/swagger";
import cors from "cors";
import logger from "@utils/logger";
import swaggerUi from "swagger-ui-express";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
const port = process.env.PORT || 3000;

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

// Serve api docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// Get latest token prices
app.get("/api/prices", getTokenPriceHandler);

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Swagger docs available at http://localhost:${port}/api-docs`);
});
