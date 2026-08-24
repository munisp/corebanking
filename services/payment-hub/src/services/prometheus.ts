import client from "prom-client";
import { Request, Response } from "express";
import logger from "../config/logger.config";

export class PrometheusService {
  private static instance: PrometheusService;
  private static readonly register = new client.Registry();
  private static readonly requestCount = new client.Counter({
    name: "http_request_total",
    help: "Total number of requests",
    labelNames: ["method", "route", "status_code"],
  });

  private static readonly sanctionsBlockedTotal = new client.Counter({
    name: "sanctions_blocked_transfers_total",
    help: "Transfers blocked or held by sanctions screening (each one is persisted to sanctions_blocked_alerts)",
    labelNames: ["tenant", "party", "action"],
  });

  private constructor() {} // prevent instantiation from outside

  /** Singleton accessor */
  static getInstance(): PrometheusService {
    if (!this.instance) {
      this.instance = new PrometheusService();
      this.initialize();
    }
    return this.instance;
  }

  /** Initialize default metrics and custom metrics */
  private static initialize(): void {
    if ((this as any)._initialized) return;
    (this as any)._initialized = true;

    client.collectDefaultMetrics({ register: this.register });
    this.register.registerMetric(this.requestCount);
    this.register.registerMetric(this.sanctionsBlockedTotal);

    logger.info("Prometheus metrics initialized successfully");
  }

  /** Record a new request */
  recordRequest(method: string, route: string, statusCode: number): void {
    PrometheusService.requestCount.labels(method, route, String(statusCode)).inc();
  }

  /** W7-C-16: count every sanctions-blocked/held transfer for alerting rules. */
  recordSanctionsBlocked(tenant: string, party: string, action: string): void {
    PrometheusService.sanctionsBlockedTotal.labels(tenant, party, action).inc();
  }

  /** Expose metrics for Prometheus to scrape */
  async handleMetricsRequest(_: Request, res: Response): Promise<void> {
    res.set("Content-Type", PrometheusService.register.contentType);
    res.end(await PrometheusService.register.metrics());
  }
}
