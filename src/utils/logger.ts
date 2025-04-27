import pino from "pino";

const PINO_LOG_LEVEL = process.env.PINO_LOG_LEVEL || "info";

const logger = pino({
  name: "nimbus-api",
  level: PINO_LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
