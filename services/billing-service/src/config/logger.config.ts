import winston from "winston";
import { readEnv } from "./readEnv.config";

const NODE_ENV = readEnv("NODE_ENV", "development") as string;

const logger = winston.createLogger({
  level: NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          }),
        ),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
