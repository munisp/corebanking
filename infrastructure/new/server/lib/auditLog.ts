/**
 * Immutable Audit Trail — Logs all CRUD operations across all domains.
 * Records: who changed what, when, with before/after snapshots.
 * Storage: Postgres-authoritative (table `audit_entries`) + JSONL file mirror.
 *
 * W12-C3-P2-MLIB (c3-1030): the audit ring buffer was process memory — a
 * restart (or >10k entries) silently destroyed the forensic audit trail.
 * Now every audit write is persisted to Postgres (fail-closed: if the insert
 * fails, log() throws — an audit event is never silently dropped) and the
 * capped in-memory array is gone. The JSONL file mirror is retained as a
 * defense-in-depth local copy. Table shared with lib/auditTrail.ts
 * (c3-1000) per the C3 register's audit_entries mapping.
 */

import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { ensureTables, storeDDL, storeInsert, storeList } from "./pgJsonStore";

const TABLE = "audit_entries";

async function ensureAuditLogStore(): Promise<void> {
  await ensureTables("auditLog", storeDDL(TABLE));
}

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

  async log(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<AuditEntry> {
    const full: AuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Fail-closed: the audit event is persisted to Postgres FIRST. If the
    // database is unavailable this throws — the mutation being audited must
    // not proceed on the assumption that an audit record exists.
    await ensureAuditLogStore();
    await storeInsert(TABLE, full.tenantId ?? "", full);

    if (this.writeStream) {
      this.writeStream.write(JSON.stringify(full) + "\n");
    }

    logger.info(`AUDIT: ${full.action} ${full.domain}/${full.resourceId ?? "N/A"} by ${full.userId} — ${full.status}`);
    return full;
  }

  async query(filters: {
    domain?: string;
    userId?: string;
    action?: string;
    resourceId?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<AuditEntry[]> {
    await ensureAuditLogStore();
    let result = await storeList<AuditEntry>(TABLE);

    if (filters.domain) result = result.filter((e) => e.domain === filters.domain);
    if (filters.userId) result = result.filter((e) => e.userId === filters.userId);
    if (filters.action) result = result.filter((e) => e.action === filters.action);
    if (filters.resourceId) result = result.filter((e) => e.resourceId === filters.resourceId);
    if (filters.from) result = result.filter((e) => e.timestamp >= filters.from!);
    if (filters.to) result = result.filter((e) => e.timestamp <= filters.to!);

    const limit = filters.limit ?? 100;
    return result.slice(-limit).reverse();
  }

  async getStats(): Promise<{
    total: number;
    byAction: Record<string, number>;
    byDomain: Record<string, number>;
    last24h: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();

    const byAction: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    let last24h = 0;

    await ensureAuditLogStore();
    const entries = await storeList<AuditEntry>(TABLE);
    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
      byDomain[entry.domain] = (byDomain[entry.domain] ?? 0) + 1;
      if (entry.timestamp >= oneDayAgo) last24h++;
    }

    return { total: entries.length, byAction, byDomain, last24h };
  }

  close(): void {
    this.writeStream?.end();
  }
}

export const auditLog = new AuditLogger();
