/**
 * Event Publisher — wires Kafka event publishing into Express routes.
 * Publishes banking domain events for audit, analytics, and real-time processing.
 *
 * Doctrine: the SSE stream at /api/events/stream forwards ONLY real events
 * observed on the event bus (via kafkaClient subscriptions) plus a replay of
 * recently published real messages (labeled source: "in-process"). No
 * synthetic or random events are ever emitted to subscribers.
 *
 * Publish honesty: kafkaClient.publish() throws KafkaUnavailableError when
 * no real producer is configured. Write endpoints surface 503/502 in that
 * case and NEVER return { published: true } for an event that was not
 * broker-acknowledged. The audit middleware logs the drop instead of
 * claiming delivery.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { publish, subscribe, getRecentMessages, KafkaUnavailableError } from "./kafkaClient";
import { cacheGet, cacheSet } from "./redisClient";
import { logger } from "./logger";

// Topics forwarded to SSE subscribers — real banking domain events only.
const SSE_STREAM_TOPICS = [
  "txn.created",
  "txn.completed",
  "txn.failed",
  "txn.reversed",
  "customer.created",
  "customer.updated",
  "customer.kyc.verified",
  "account.opened",
  "account.closed",
  "account.balance.changed",
  "loan.disbursed",
  "loan.repaid",
  "loan.overdue",
  "aml.alert",
  "aml.sar.filed",
  "fraud.detected",
  "auth.login",
  "auth.logout",
  "auth.failed",
  "audit.event",
];

/** Respond 503/502 for a failed publish — never { published: true }. */
function respondPublishFailure(res: Response, eventType: string, err: unknown): void {
  if (err instanceof KafkaUnavailableError) {
    res.status(503).json({ published: false, event: eventType, error: "event_bus_unavailable", message: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[EventPublisher] Publish ${eventType} failed: ${message}`);
  res.status(502).json({ published: false, event: eventType, error: "publish_failed", message });
}

// Event publishing middleware — publishes events based on route patterns
export function registerEventPublisher(app: Express): void {
  // Publish audit events for all write operations. When no real producer is
  // configured the event is DROPPED with a loud log — never silently treated
  // as delivered.
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
          }).catch((err) => {
            logger.warn(`[EventPublisher] Audit event dropped (not published): ${err?.message ?? err}`);
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
  app.post("/api/events/transaction", async (req, res) => {
    const { type, transactionId, accountId, amount, currency } = req.body || {};
    const eventType = type === "completed" ? "txn.completed" : type === "failed" ? "txn.failed" : "txn.created";
    try {
      await publish(eventType, {
        transactionId: transactionId || `TXN-${Date.now()}`,
        accountId,
        amount,
        currency: currency || "NGN",
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({ published: true, event: eventType });
    } catch (err) {
      respondPublishFailure(res, eventType, err);
    }
  });

  // Customer event publishing
  app.post("/api/events/customer", async (req, res) => {
    const { type, customerId, action } = req.body || {};
    const eventType = type === "kyc" ? "customer.kyc.verified" : type === "updated" ? "customer.updated" : "customer.created";
    try {
      await publish(eventType, {
        customerId: customerId || `CUST-${Date.now()}`,
        action: action || type || "created",
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({ published: true, event: eventType });
    } catch (err) {
      respondPublishFailure(res, eventType, err);
    }
  });

  // AML alert publishing
  app.post("/api/events/aml-alert", async (req, res) => {
    const { customerId, alertType, riskScore, details } = req.body || {};
    try {
      await publish("aml.alert", {
        customerId: customerId || "unknown",
        alertType: alertType || "suspicious_activity",
        riskScore: riskScore || 0,
        details: details || "",
        timestamp: new Date().toISOString(),
      });
      res.status(201).json({ published: true, event: "aml.alert" });
    } catch (err) {
      respondPublishFailure(res, "aml.alert", err);
    }
  });

  // Event stream endpoint — SSE stream of REAL events only.
  // Replays recently published real messages (labeled in-process) on
  // connect, then live-forwards events observed on the event bus. No
  // fabricated heartbeats or random transactions are emitted; a comment
  // keep-alive keeps the socket open.
  app.get("/api/events/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let closed = false;
    const writeEvent = (topic: string, data: unknown) => {
      if (closed) return;
      try {
        res.write(`event: ${topic}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        closed = true;
      }
    };

    // Replay recent real events so a new subscriber sees actual history
    // (in-process ring buffer only — explicitly labeled as such).
    for (const entry of getRecentMessages(undefined, 20)) {
      writeEvent(entry.topic, { ...entry.message, _replayed: true, _source: entry.source, _publishedAt: entry.timestamp });
    }

    // Live-forward real bus events for the duration of the connection
    for (const topic of SSE_STREAM_TOPICS) {
      subscribe(topic, (t, msg) => writeEvent(t, { ...(typeof msg === "object" && msg !== null ? msg : { value: msg }), _source: "in-process" }));
    }

    // SSE comment keep-alive (not an event — carries no fabricated data)
    const keepAlive = setInterval(() => {
      if (!closed) {
        try {
          res.write(": keep-alive\n\n");
        } catch {
          closed = true;
        }
      }
    }, 25000);

    req.on("close", () => {
      closed = true;
      clearInterval(keepAlive);
    });
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
