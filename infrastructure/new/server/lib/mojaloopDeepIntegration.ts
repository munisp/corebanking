/**
 * Deep Mojaloop Integration — FSPIOP Callbacks, ILP, Settlement Windows,
 * Admin API, Cross-Border Corridors, TigerBeetle Bridging
 *
 * This module is a thin gateway to the REAL Mojaloop connector service. It
 * holds no in-memory settlement windows, ILP packets, callback telemetry,
 * corridor volumes, or bridge entries. Every route proxies to the connector
 * and fails fast with 503 `mojaloop_connector_unavailable` when the connector
 * cannot be reached — nothing is fabricated.
 *
 * Configuration:
 *   MOJALOOP_CONNECTOR_URL — base URL of the Mojaloop connector
 *                            (default http://localhost:8124, matching
 *                            server/index.ts)
 */

import { logger } from "./logger";

const MOJALOOP_CONNECTOR_URL = process.env.MOJALOOP_CONNECTOR_URL || "http://localhost:8124";
const UPSTREAM_TIMEOUT_MS = Number.parseInt(process.env.MOJALOOP_UPSTREAM_TIMEOUT_MS || "5000", 10);

/**
 * Proxies a request to the Mojaloop connector, passing through the upstream
 * status code and body verbatim. On network/timeout failure responds 503.
 */
async function proxyToConnector(req: any, res: any, upstreamPath: string) {
  try {
    const queryIndex = req.originalUrl?.indexOf("?") ?? -1;
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
    const upstream = await fetch(`${MOJALOOP_CONNECTOR_URL}${upstreamPath}${query}`, {
      method: req.method || "GET",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: req.method && !["GET", "HEAD"].includes(req.method) && req.body ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await upstream.text();
    res.status(upstream.status).type("application/json").send(body);
  } catch (error) {
    logger.error("Mojaloop connector unreachable", { upstreamPath, error: String(error) });
    res.status(503).json({
      error: "mojaloop_connector_unavailable",
      message: "Mojaloop connector service is unavailable; no settlement, ILP, or corridor data can be served",
      upstream: upstreamPath,
    });
  }
}

// ── Express Registration ──

export function registerMojaloopDeepIntegration(app: any) {
  // FSPIOP Callbacks
  app.get("/api/platform/mojaloop/callbacks", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/callbacks");
  });
  app.get("/api/platform/mojaloop/callback-endpoints", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/callback-endpoints");
  });

  // ILP Packets
  app.get("/api/platform/mojaloop/ilp-packets", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/ilp-packets");
  });

  // Settlement Windows
  app.get("/api/platform/mojaloop/settlement-windows", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/settlement-windows");
  });
  app.get("/api/platform/mojaloop/settlement-models", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/settlement-models");
  });

  // Admin — Participants
  app.get("/api/platform/mojaloop/admin/participants", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/participants");
  });
  app.get("/api/platform/mojaloop/admin/limits", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/limits");
  });

  // Cross-Border Corridors
  app.get("/api/platform/mojaloop/corridors", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/corridors");
  });
  app.get("/api/platform/mojaloop/corridors/stats", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/corridors/stats");
  });

  // TigerBeetle Bridge
  app.get("/api/platform/mojaloop/tb-bridge/entries", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/tb-bridge/entries");
  });
  app.get("/api/platform/mojaloop/tb-bridge/configs", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/tb-bridge/configs");
  });
  app.get("/api/platform/mojaloop/tb-bridge/stats", (req: any, res: any) => {
    void proxyToConnector(req, res, "/v1/mojaloop/tb-bridge/stats");
  });
}
