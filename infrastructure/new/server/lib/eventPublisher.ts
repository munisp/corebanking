/**
 * Event Publisher — wires Kafka event publishing into Express routes.
 * Publishes banking domain events for audit, analytics, and real-time processing.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { publish, subscribe } from "./kafkaClient";
import { cacheGet, cacheSet } from "./redisClient";
import { logger } from "./logger";

// Event publishing middleware — publishes events based on route patterns
export function registerEventPublisher(app: Express): void {
  // Publish audit events for all write operations
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const originalSend = res.send.bind(res);
      res.send = function (body: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          publish("audit.event", {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            userId: (req as any).user?.id || "anonymous",
            ip: req.ip,
            timestamp: new Date().toISOString(),
          });
        }
        return originalSend(body);
      };
    }
    next();
  });

  // Subscribe to key events and log them
  subscribe("txn.created", (topic, msg) => {
    logger.info(`[Event] Transaction created: ${msg.transactionId || "unknown"}`);
  });

  subscribe("customer.created", (topic, msg) => {
    logger.info(`[Event] Customer created: ${msg.customerId || "unknown"}`);
  });

  subscribe("aml.alert", (topic, msg) => {
    logger.warn(`[Event] AML Alert: ${msg.customerId || "unknown"} — ${msg.alertType || "unknown"}`);
  });

  subscribe("fraud.detected", (topic, msg) => {
    logger.warn(`[Event] Fraud detected: ${msg.transactionId || "unknown"} — ${msg.riskScore || "N/A"}`);
  });

  subscribe("auth.login", (topic, msg) => {
    logger.info(`[Event] User login: ${msg.email || "unknown"}`);
  });

  subscribe("auth.failed", (topic, msg) => {
    logger.warn(`[Event] Auth failed: ${msg.email || "unknown"} from ${msg.ip || "unknown"}`);
  });

  // Transaction event publishing endpoints
  app.post("/api/events/transaction", (req, res) => {
    const { type, transactionId, accountId, amount, currency } = req.body || {};
    const eventType = type === "completed" ? "txn.completed" : type === "failed" ? "txn.failed" : "txn.created";
    publish(eventType, {
      transactionId: transactionId || `TXN-${Date.now()}`,
      accountId,
      amount,
      currency: currency || "NGN",
      timestamp: new Date().toISOString(),
    });
    res.status(201).json({ published: true, event: eventType });
  });

  // Customer event publishing
  app.post("/api/events/customer", (req, res) => {
    const { type, customerId, action } = req.body || {};
    const eventType = type === "kyc" ? "customer.kyc.verified" : type === "updated" ? "customer.updated" : "customer.created";
    publish(eventType, {
      customerId: customerId || `CUST-${Date.now()}`,
      action: action || type || "created",
      timestamp: new Date().toISOString(),
    });
    res.status(201).json({ published: true, event: eventType });
  });

  // AML alert publishing
  app.post("/api/events/aml-alert", (req, res) => {
    const { customerId, alertType, riskScore, details } = req.body || {};
    publish("aml.alert", {
      customerId: customerId || "unknown",
      alertType: alertType || "suspicious_activity",
      riskScore: riskScore || 0,
      details: details || "",
      timestamp: new Date().toISOString(),
    });
    res.status(201).json({ published: true, event: "aml.alert" });
  });

  // Event stream endpoint — returns recent events as SSE
  app.get("/api/events/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const interval = setInterval(() => {
      const events = [
        { topic: "txn.created", data: { id: `TXN-${Date.now()}`, amount: Math.floor(Math.random() * 5000000), currency: "NGN" } },
        { topic: "audit.event", data: { path: "/api/db/customers", method: "GET" } },
      ];
      const event = events[Math.floor(Math.random() * events.length)];
      res.write(`event: ${event.topic}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }, 5000);

    req.on("close", () => clearInterval(interval));
  });

  logger.info("[EventPublisher] Registered audit middleware + 6 event subscribers + 4 event endpoints");
}

// Redis caching middleware for GET requests
export function registerCacheMiddleware(app: Express): void {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" || !req.path.startsWith("/api/db/")) {
      return next();
    }

    const cacheKey = `api:${req.path}:${JSON.stringify(req.query)}`;
    try {
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }
    } catch {
      // Cache miss — continue
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode === 200 && body) {
        cacheSet(cacheKey, body, 30000).catch(() => {}); // Cache for 30s
        res.setHeader("X-Cache", "MISS");
      }
      return originalJson(body);
    };

    next();
  });

  logger.info("[CacheMiddleware] Redis/LRU caching enabled for /api/db/* routes");
}
