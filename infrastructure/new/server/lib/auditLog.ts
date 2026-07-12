/**
 * Immutable Audit Trail — Logs all CRUD operations across all domains.
 * Records: who changed what, when, with before/after snapshots.
 * Storage: In-memory + file-based (replace with DB table in production).
 */

import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  tenantId: string;
  action: "create" | "read" | "update" | "delete" | "action" | "export" | "login" | "logout";
  domain: string;
  resourceId?: string;
  resourceType: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  status: "success" | "failure";
  errorMessage?: string;
}

class AuditLogger {
  private entries: AuditEntry[] = [];
  private readonly maxInMemory = 10_000;
  private readonly logFilePath: string;
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    const logDir = process.env.AUDIT_LOG_DIR || path.resolve(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      try { fs.mkdirSync(logDir, { recursive: true }); } catch { /* ignore */ }
    }
    this.logFilePath = path.join(logDir, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`);
    try {
      this.writeStream = fs.createWriteStream(this.logFilePath, { flags: "a" });
    } catch {
      logger.warn("Could not open audit log file, using in-memory only");
    }
  }

  log(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
    const full: AuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.entries.push(full);
    if (this.entries.length > this.maxInMemory) {
      this.entries = this.entries.slice(-this.maxInMemory);
    }

    if (this.writeStream) {
      this.writeStream.write(JSON.stringify(full) + "\n");
    }

    logger.info(`AUDIT: ${full.action} ${full.domain}/${full.resourceId ?? "N/A"} by ${full.userId} — ${full.status}`);
    return full;
  }

  query(filters: {
    domain?: string;
    userId?: string;
    action?: string;
    resourceId?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): AuditEntry[] {
    let result = this.entries;

    if (filters.domain) result = result.filter((e) => e.domain === filters.domain);
    if (filters.userId) result = result.filter((e) => e.userId === filters.userId);
    if (filters.action) result = result.filter((e) => e.action === filters.action);
    if (filters.resourceId) result = result.filter((e) => e.resourceId === filters.resourceId);
    if (filters.from) result = result.filter((e) => e.timestamp >= filters.from!);
    if (filters.to) result = result.filter((e) => e.timestamp <= filters.to!);

    const limit = filters.limit ?? 100;
    return result.slice(-limit).reverse();
  }

  getStats(): {
    total: number;
    byAction: Record<string, number>;
    byDomain: Record<string, number>;
    last24h: number;
  } {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();

    const byAction: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    let last24h = 0;

    for (const entry of this.entries) {
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
      byDomain[entry.domain] = (byDomain[entry.domain] ?? 0) + 1;
      if (entry.timestamp >= oneDayAgo) last24h++;
    }

    return { total: this.entries.length, byAction, byDomain, last24h };
  }

  close(): void {
    this.writeStream?.end();
  }
}

export const auditLog = new AuditLogger();
