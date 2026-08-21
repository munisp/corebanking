/**
 * TigerBeetle Double-Entry Ledger — gateway to the REAL TigerBeetle cluster.
 *
 * There is NO in-memory ledger in this module. A transfer is only reported as
 * "posted" when the TigerBeetle cluster has accepted it through the official
 * `tigerbeetle-node` client, and reconciliation compares real cluster balances
 * against Postgres. When the client library or cluster is unavailable, every
 * data route fails fast with 503 `ledger_unavailable`; when Postgres is
 * unavailable, reconciliation fails with 503 `source_unavailable`.
 *
 * Configuration:
 *   TIGERBEETLE_ADDRESSES   — comma-separated replica addresses (required)
 *   TIGERBEETLE_CLUSTER_ID  — u128 cluster id (default "0")
 */
import { createHash } from "crypto";
import { createRequire } from "module";
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "./logger";

// ── Ledger catalogue (static metadata only — no balances, counts, or totals) ──
interface LedgerDefinition {
  id: number;
  name: string;
  currency: string;
  description: string;
}

const LEDGERS: LedgerDefinition[] = [
  { id: 1, name: "NGN Operating", currency: "NGN", description: "Nigerian Naira operating accounts" },
  { id: 2, name: "USD Nostro", currency: "USD", description: "US Dollar correspondent banking" },
  { id: 3, name: "GBP Nostro", currency: "GBP", description: "British Pound correspondent banking" },
  { id: 4, name: "EUR Nostro", currency: "EUR", description: "Euro correspondent banking" },
  { id: 5, name: "Loan Portfolio", currency: "NGN", description: "All loan disbursements and repayments" },
  { id: 6, name: "Card Settlement", currency: "NGN", description: "Card transaction settlements" },
  { id: 7, name: "FX Dealing", currency: "NGN", description: "Foreign exchange position management" },
  { id: 8, name: "Fee & Commission", currency: "NGN", description: "Platform fee collection" },
  { id: 9, name: "Escrow", currency: "NGN", description: "Escrow and trust accounts" },
  { id: 10, name: "Mojaloop Settlement", currency: "NGN", description: "Interoperability settlement accounts" },
  { id: 11, name: "Agent Float", currency: "NGN", description: "Agent banking float management" },
  { id: 12, name: "Microfinance Savings", currency: "NGN", description: "Microfinance group savings" },
];

// ── Real TigerBeetle client (lazy; never faked) ──

interface TBClient {
  createAccounts(accounts: unknown[]): Promise<Array<{ index: number; result: number }>>;
  createTransfers(transfers: unknown[]): Promise<Array<{ index: number; result: number }>>;
  lookupAccounts(ids: bigint[]): Promise<Array<Record<string, unknown>>>;
  lookupTransfers(ids: bigint[]): Promise<Array<Record<string, unknown>>>;
}

let clientPromise: Promise<TBClient | null> | null = null;

function tigerBeetleConfigured(): boolean {
  return Boolean(process.env.TIGERBEETLE_ADDRESSES?.trim());
}

async function getTBClient(): Promise<TBClient | null> {
  if (!tigerBeetleConfigured()) {
    return null;
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        // The official client is CJS; require() keeps this ESM module bootable
        // even when the dependency is not installed.
        const require = createRequire(import.meta.url);
        const tb = require("tigerbeetle-node");
        const addresses = process
          .env.TIGERBEETLE_ADDRESSES!.split(",")
          .map((a) => a.trim())
          .filter(Boolean);
        const clusterId = BigInt(process.env.TIGERBEETLE_CLUSTER_ID || "0");
        const client = tb.createClient({ cluster_id: clusterId, replica_addresses: addresses });
        logger.info("TigerBeetle client initialized", { addresses: addresses.length });
        return client as TBClient;
      } catch (error) {
        logger.error("TigerBeetle client initialization failed", { error: String(error) });
        return null;
      }
    })();
  }
  return clientPromise;
}

// ── Helpers ──

/** Deterministically maps an external string id to a TigerBeetle u128 id. */
function toU128(id: string): bigint {
  return BigInt(`0x${createHash("sha256").update(id).digest("hex").slice(0, 32)}`);
}

function u128ToHex(id: unknown): string {
  if (typeof id === "bigint") return `0x${id.toString(16).padStart(32, "0")}`;
  return String(id);
}

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapAccount(raw: Record<string, unknown>) {
  const debitsPosted = num(raw.debits_posted);
  const creditsPosted = num(raw.credits_posted);
  return {
    id: u128ToHex(raw.id),
    ledger: num(raw.ledger),
    code: num(raw.code),
    debitsPending: num(raw.debits_pending),
    debitsPosted,
    creditsPending: num(raw.credits_pending),
    creditsPosted,
    balance: creditsPosted - debitsPosted,
    flagsBitmask: num(raw.flags),
  };
}

function mapTransfer(raw: Record<string, unknown>) {
  const flags = num(raw.flags);
  return {
    id: u128ToHex(raw.id),
    debitAccountId: u128ToHex(raw.debit_account_id),
    creditAccountId: u128ToHex(raw.credit_account_id),
    amount: num(raw.amount),
    ledger: num(raw.ledger),
    code: num(raw.code),
    pendingId: raw.pending_id ? u128ToHex(raw.pending_id) : undefined,
    flagsBitmask: flags,
    // TigerBeetle TransferFlags: pending = 1 << 1
    status: (flags & 2) !== 0 ? "pending" : "posted",
  };
}

function ledgerUnavailable(res: Response) {
  return res.status(503).json({
    error: "ledger_unavailable",
    message: "TigerBeetle client not configured",
  });
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      logger.error("TigerBeetle ledger route failed", { path: req.path, error: String(error) });
      if (!res.headersSent) {
        res.status(500).json({ error: "internal_error", message: "Ledger request failed" });
      }
    });
  };
}

function parseIds(req: Request): string[] {
  const raw = String(req.query.ids ?? "").trim();
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 1000) : [];
}

// ── Route registration ──

export function registerTigerBeetleLedger(app: Express) {
  // Ledger catalogue (static metadata; contains no financial state)
  app.get("/api/tigerbeetle/v1/ledgers", (_req: Request, res: Response) => {
    res.json({ items: LEDGERS, total: LEDGERS.length });
  });

  // Accounts — real cluster lookups only; TigerBeetle has no "list all" API,
  // so callers must provide the ids they want to inspect.
  app.get("/api/tigerbeetle/v1/accounts", asyncHandler(async (req, res) => {
    const client = await getTBClient();
    if (!client) return ledgerUnavailable(res);
    const ids = parseIds(req);
    if (ids.length === 0) {
      return res.status(400).json({ error: "ids_required", message: "Provide ?ids=<id,id,...> — cluster accounts cannot be enumerated" });
    }
    const accounts = await client.lookupAccounts(ids.map(toU128));
    res.json({ items: accounts.map(mapAccount), total: accounts.length });
  }));

  app.get("/api/tigerbeetle/v1/accounts/:id", asyncHandler(async (req, res) => {
    const client = await getTBClient();
    if (!client) return ledgerUnavailable(res);
    const accounts = await client.lookupAccounts([toU128(req.params.id)]);
    if (accounts.length === 0) return res.status(404).json({ error: "Account not found" });
    res.json(mapAccount(accounts[0]));
  }));

  app.post("/api/tigerbeetle/v1/accounts", asyncHandler(async (req, res) => {
    const client = await getTBClient();
    if (!client) return ledgerUnavailable(res);
    const { id, ledger, code, description } = req.body ?? {};
    const ledgerNum = Number(ledger);
    const codeNum = Number(code);
    if (!Number.isInteger(ledgerNum) || ledgerNum <= 0 || !Number.isInteger(codeNum) || codeNum <= 0) {
      return res.status(400).json({ error: "validation_error", message: "Positive integer ledger and code are required" });
    }
    const externalId = typeof id === "string" && id.trim() ? id.trim() : `tb-acc-${createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 16)}`;
    const tbId = toU128(externalId);
    const errors = await client.createAccounts([{ id: tbId, ledger: ledgerNum, code: codeNum }]);
    if (errors.length > 0) {
      logger.error("TigerBeetle account creation rejected by cluster", { externalId, errors });
      return res.status(502).json({ error: "cluster_rejected", message: "TigerBeetle cluster rejected the account", clusterErrors: errors });
    }
    const [created] = await client.lookupAccounts([tbId]);
    res.status(201).json({ externalId, description: description ?? null, ...mapAccount(created ?? { id: tbId, ledger: ledgerNum, code: codeNum }) });
  }));

  // Transfers — only real cluster-committed transfers are ever returned.
  app.get("/api/tigerbeetle/v1/transfers", asyncHandler(async (req, res) => {
    const client = await getTBClient();
    if (!client) return ledgerUnavailable(res);
    const ids = parseIds(req);
    if (ids.length === 0) {
      return res.status(400).json({ error: "ids_required", message: "Provide ?ids=<id,id,...> — cluster transfers cannot be enumerated" });
    }
    const transfers = await client.lookupTransfers(ids.map(toU128));
    res.json({ items: transfers.map(mapTransfer), total: transfers.length });
  }));

  app.post("/api/tigerbeetle/v1/transfers", asyncHandler(async (req, res) => {
    const client = await getTBClient();
    if (!client) return ledgerUnavailable(res);
    const { id, debitAccountId, creditAccountId, amount, ledger, code, narration } = req.body ?? {};
    const amountNum = Number(amount);
    if (!debitAccountId || !creditAccountId || !Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "validation_error", message: "debitAccountId, creditAccountId and a positive amount are required" });
    }
    const ledgerNum = Number(ledger ?? 1);
    const codeNum = Number(code ?? 100);
    if (!Number.isInteger(ledgerNum) || ledgerNum <= 0 || !Number.isInteger(codeNum) || codeNum <= 0) {
      return res.status(400).json({ error: "validation_error", message: "Positive integer ledger and code are required" });
    }
    const externalId = typeof id === "string" && id.trim() ? id.trim() : `tb-txn-${createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 16)}`;
    const transfer = {
      id: toU128(externalId),
      debit_account_id: toU128(String(debitAccountId)),
      credit_account_id: toU128(String(creditAccountId)),
      amount: BigInt(Math.trunc(amountNum)),
      ledger: ledgerNum,
      code: codeNum,
    };
    const errors = await client.createTransfers([transfer]);
    if (errors.length > 0) {
      logger.error("TigerBeetle transfer rejected by cluster", { externalId, errors });
      return res.status(502).json({ error: "cluster_rejected", message: "TigerBeetle cluster rejected the transfer", clusterErrors: errors });
    }
    const [committed] = await client.lookupTransfers([transfer.id]);
    res.status(201).json({ externalId, narration: narration ?? null, ...mapTransfer(committed ?? { ...transfer, flags: 0 }) });
  }));

  // Reconciliation — compares REAL TigerBeetle balances against REAL Postgres
  // balances and reports the actual mismatches. Fails fast (503) when either
  // source is unavailable; never reports "balanced" without real data.
  app.get("/api/tigerbeetle/v1/reconciliation", asyncHandler(async (_req, res) => {
    const client = await getTBClient();
    if (!client) return ledgerUnavailable(res);
    const db = await getDb();
    if (!db) {
      return res.status(503).json({
        error: "source_unavailable",
        message: "Postgres is unavailable; reconciliation requires both TigerBeetle and Postgres",
      });
    }

    let rows: Array<{ tb_id: string; balance: number }>;
    try {
      const result = await db.execute(sql`
        SELECT tigerbeetle_account_id::text AS tb_id, available_balance::float8 AS balance
        FROM account_balances
        WHERE tigerbeetle_account_id IS NOT NULL
      `);
      rows = ((result as unknown as { rows?: unknown[] }).rows ?? []) as Array<{ tb_id: string; balance: number }>;
    } catch (error) {
      logger.error("Reconciliation Postgres source query failed", { error: String(error) });
      return res.status(503).json({
        error: "source_unavailable",
        message: "Postgres balance source query failed; reconciliation cannot run",
        detail: String(error),
      });
    }

    let clusterAccounts: Array<Record<string, unknown>>;
    try {
      clusterAccounts = await client.lookupAccounts(rows.map((r) => toU128(String(r.tb_id))));
    } catch (error) {
      logger.error("Reconciliation TigerBeetle lookup failed", { error: String(error) });
      return res.status(503).json({
        error: "source_unavailable",
        message: "TigerBeetle cluster lookup failed; reconciliation cannot run",
        detail: String(error),
      });
    }

    const byId = new Map(clusterAccounts.map((a) => [u128ToHex(a.id), a]));
    const mismatches: Array<{ accountId: string; tigerbeetleBalance: number | null; postgresBalance: number; difference: number | null }> = [];
    for (const row of rows) {
      const account = byId.get(u128ToHex(toU128(String(row.tb_id))));
      const tbBalance = account ? num(account.credits_posted) - num(account.debits_posted) : null;
      const pgBalance = Number(row.balance);
      if (tbBalance === null || tbBalance !== pgBalance) {
        mismatches.push({
          accountId: String(row.tb_id),
          tigerbeetleBalance: tbBalance,
          postgresBalance: pgBalance,
          difference: tbBalance === null ? null : tbBalance - pgBalance,
        });
      }
    }

    res.json({
      status: mismatches.length === 0 ? "balanced" : "mismatches_found",
      accountsChecked: rows.length,
      accountsFoundInCluster: clusterAccounts.length,
      mismatchedAccounts: mismatches.length,
      mismatches,
      reconciledAt: new Date().toISOString(),
    });
  }));

  // Stats — only real cluster connectivity information; no fabricated throughput.
  app.get("/api/tigerbeetle/v1/stats", asyncHandler(async (_req, res) => {
    const client = await getTBClient();
    if (!client) return ledgerUnavailable(res);
    res.json({
      clusterStatus: "connected",
      replicaAddresses: process.env.TIGERBEETLE_ADDRESSES!.split(",").map((a) => a.trim()).filter(Boolean),
      clusterId: process.env.TIGERBEETLE_CLUSTER_ID || "0",
      ledgersDefined: LEDGERS.length,
    });
  }));
}
