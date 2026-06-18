/**
 * G5: Environment-specific configuration — Production
 */
export const config = {
  env: "production",
  port: Number(process.env.PORT) || 3000,
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: 20,
    ssl: true,
  },
  redis: {
    url: process.env.REDIS_URL!,
    ttlSeconds: 60,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "").split(","),
    clientId: "54bank-gateway-prod",
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    sessionTtlSeconds: 3600,
    requireAuth: true,
  },
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 100,
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
  },
  logging: {
    level: "info",
    format: "json",
  },
  services: {
    tellerUrl: process.env.TELLER_URL || "http://teller-operations:8090",
    paymentsUrl: process.env.PAYMENTS_URL || "http://payments-hub:8091",
    islamicUrl: process.env.ISLAMIC_URL || "http://islamic-banking:8092",
    tradeFinanceUrl: process.env.TRADE_FINANCE_URL || "http://trade-finance:8093",
  },
};
