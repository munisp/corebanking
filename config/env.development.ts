/**
 * G5: Environment-specific configuration — Development
 */
export const config = {
  env: "development",
  port: 3000,
  database: {
    url: process.env.DATABASE_URL || "postgresql://banking:banking_dev_password@localhost:5432/banking54",
    poolSize: 5,
    ssl: false,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    ttlSeconds: 300,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: "54bank-gateway-dev",
  },
  auth: {
    jwtSecret: "dev-secret-do-not-use-in-production",
    sessionTtlSeconds: 86400,
    requireAuth: false,
  },
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 1000,
  },
  cors: {
    origins: ["http://localhost:3000", "http://localhost:5173"],
  },
  logging: {
    level: "debug",
    format: "pretty",
  },
  services: {
    tellerUrl: "http://localhost:8090",
    paymentsUrl: "http://localhost:8091",
    islamicUrl: "http://localhost:8092",
    tradeFinanceUrl: "http://localhost:8093",
  },
};
