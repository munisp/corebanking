/**
 * Prometheus Metrics — Request count, latency histograms, error rates.
 * Exposes /metrics endpoint in Prometheus text format.
 */

import type { Request, Response, NextFunction } from "express";

interface HistogramBucket {
  le: number;
  count: number;
}

interface MetricCounter {
  labels: Record<string, string>;
  value: number;
}

interface LatencyHistogram {
  labels: Record<string, string>;
  sum: number;
  count: number;
  buckets: HistogramBucket[];
}

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class PrometheusRegistry {
  private counters = new Map<string, MetricCounter[]>();
  private histograms = new Map<string, LatencyHistogram[]>();
  private gauges = new Map<string, MetricCounter[]>();

  incCounter(name: string, labels: Record<string, string>, value = 1): void {
    const entries = this.counters.get(name) ?? [];
    const existing = entries.find((e) => this.labelsMatch(e.labels, labels));
    if (existing) {
      existing.value += value;
    } else {
      entries.push({ labels, value });
      this.counters.set(name, entries);
    }
  }

  setGauge(name: string, labels: Record<string, string>, value: number): void {
    const entries = this.gauges.get(name) ?? [];
    const existing = entries.find((e) => this.labelsMatch(e.labels, labels));
    if (existing) {
      existing.value = value;
    } else {
      entries.push({ labels, value });
      this.gauges.set(name, entries);
    }
  }

  observeHistogram(name: string, labels: Record<string, string>, value: number): void {
    const entries = this.histograms.get(name) ?? [];
    let existing = entries.find((e) => this.labelsMatch(e.labels, labels));
    if (!existing) {
      existing = {
        labels,
        sum: 0,
        count: 0,
        buckets: BUCKETS.map((le) => ({ le, count: 0 })),
      };
      entries.push(existing);
      this.histograms.set(name, entries);
    }
    existing.sum += value;
    existing.count += 1;
    for (const bucket of existing.buckets) {
      if (value <= bucket.le) bucket.count += 1;
    }
  }

  serialize(): string {
    const lines: string[] = [];

    Array.from(this.counters.entries()).forEach(([name, entries]) => {
      lines.push(`# TYPE ${name} counter`);
      for (const entry of entries) {
        lines.push(`${name}${this.formatLabels(entry.labels)} ${entry.value}`);
      }
    });

    Array.from(this.gauges.entries()).forEach(([name, entries]) => {
      lines.push(`# TYPE ${name} gauge`);
      for (const entry of entries) {
        lines.push(`${name}${this.formatLabels(entry.labels)} ${entry.value}`);
      }
    });

    Array.from(this.histograms.entries()).forEach(([name, entries]) => {
      lines.push(`# TYPE ${name} histogram`);
      for (const entry of entries) {
        for (const bucket of entry.buckets) {
          lines.push(`${name}_bucket${this.formatLabels({ ...entry.labels, le: String(bucket.le) })} ${bucket.count}`);
        }
        lines.push(`${name}_bucket${this.formatLabels({ ...entry.labels, le: "+Inf" })} ${entry.count}`);
        lines.push(`${name}_sum${this.formatLabels(entry.labels)} ${entry.sum}`);
        lines.push(`${name}_count${this.formatLabels(entry.labels)} ${entry.count}`);
      }
    });

    return lines.join("\n") + "\n";
  }

  private formatLabels(labels: Record<string, string>): string {
    const parts = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return parts.length > 0 ? `{${parts.join(",")}}` : "";
  }

  private labelsMatch(a: Record<string, string>, b: Record<string, string>): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => a[k] === b[k]);
  }
}

export const registry = new PrometheusRegistry();

export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const durationSec = durationMs / 1000;

      const labels = {
        method: req.method,
        path: normalizePath(req.path),
        status: String(res.statusCode),
      };

      registry.incCounter("http_requests_total", labels);
      registry.observeHistogram("http_request_duration_seconds", labels, durationSec);

      if (res.statusCode >= 400) {
        registry.incCounter("http_errors_total", { method: req.method, status: String(res.statusCode) });
      }
    });

    next();
  };
}

function normalizePath(p: string): string {
  return p
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/\d+/g, "/:id")
    .replace(/\/[A-Z]{2,}-\d+/g, "/:ref");
}

export function metricsEndpoint(_req: Request, res: Response): void {
  registry.setGauge("process_uptime_seconds", {}, process.uptime());
  const mem = process.memoryUsage();
  registry.setGauge("process_heap_used_bytes", {}, mem.heapUsed);
  registry.setGauge("process_heap_total_bytes", {}, mem.heapTotal);
  registry.setGauge("process_rss_bytes", {}, mem.rss);

  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(registry.serialize());
}
