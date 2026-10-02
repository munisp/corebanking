/**
 * B1: Double-entry ledger engine.
 * Ensures every financial transaction has balanced debit and credit entries.
 * Supports chart of accounts, journal entries, trial balance, and GL aggregation.
 *
 * W12-C3-P0 (top-risk #1): the GL journal and chart of accounts were held in
 * process memory (lost on restart, divergent across replicas). They are now
 * Postgres-authoritative via the server's drizzle pool:
 *   - chart_of_accounts   (CoA metadata — TigerBeetle cannot model this)
 *   - gl_journal_entries  + gl_journal_lines (real double-entry journal)
 *   - a DEFERRABLE INITIALLY DEFERRED constraint trigger enforces
 *     Σdebits = Σcredits per entry at COMMIT time (defense-in-depth on top of
 *     the app-level validateJournalBalance check).
 * Posting runs in a single transaction: header + lines + balance trigger —
 * no half-posted entries.
 */

import { sql } from "drizzle-orm";
import { exec, ensureTables, withTx } from "./pgJsonStore";

export interface ChartOfAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent?: string;
  currency: string;
  balance: number;
  status: "active" | "frozen" | "closed";
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  entries: LedgerEntry[];
  status: "pending" | "posted" | "reversed";
  postedBy: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerEntry {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  currency: string;
  narration: string;
}

// Chart of accounts seed — Nigerian banking standard. Seeded into
// chart_of_accounts once (ON CONFLICT DO NOTHING); afterwards Postgres owns
// the data and restarts no longer reset it.
const CHART_OF_ACCOUNTS_SEED: ChartOfAccount[] = [
  // Assets
  { code: "1000", name: "Cash and Balances with CBN", type: "asset", currency: "NGN", balance: 45_000_000_000, status: "active" },
  { code: "1100", name: "Treasury Bills", type: "asset", currency: "NGN", balance: 120_000_000_000, status: "active" },
  { code: "1200", name: "Loans and Advances", type: "asset", currency: "NGN", balance: 380_000_000_000, status: "active" },
  { code: "1210", name: "Personal Loans", type: "asset", parent: "1200", currency: "NGN", balance: 85_000_000_000, status: "active" },
  { code: "1220", name: "Corporate Loans", type: "asset", parent: "1200", currency: "NGN", balance: 195_000_000_000, status: "active" },
  { code: "1230", name: "Mortgage Loans", type: "asset", parent: "1200", currency: "NGN", balance: 55_000_000_000, status: "active" },
  { code: "1240", name: "Agriculture Loans", type: "asset", parent: "1200", currency: "NGN", balance: 45_000_000_000, status: "active" },
  { code: "1300", name: "Fixed Assets", type: "asset", currency: "NGN", balance: 28_000_000_000, status: "active" },
  { code: "1400", name: "Other Assets", type: "asset", currency: "NGN", balance: 15_000_000_000, status: "active" },

  // Liabilities
  { code: "2000", name: "Customer Deposits", type: "liability", currency: "NGN", balance: 420_000_000_000, status: "active" },
  { code: "2010", name: "Savings Deposits", type: "liability", parent: "2000", currency: "NGN", balance: 180_000_000_000, status: "active" },
  { code: "2020", name: "Current Account Deposits", type: "liability", parent: "2000", currency: "NGN", balance: 150_000_000_000, status: "active" },
  { code: "2030", name: "Fixed Deposits", type: "liability", parent: "2000", currency: "NGN", balance: 90_000_000_000, status: "active" },
  { code: "2100", name: "Borrowings", type: "liability", currency: "NGN", balance: 65_000_000_000, status: "active" },
  { code: "2200", name: "Other Liabilities", type: "liability", currency: "NGN", balance: 18_000_000_000, status: "active" },

  // Equity
  { code: "3000", name: "Share Capital", type: "equity", currency: "NGN", balance: 50_000_000_000, status: "active" },
  { code: "3100", name: "Retained Earnings", type: "equity", currency: "NGN", balance: 25_000_000_000, status: "active" },
  { code: "3200", name: "Reserves", type: "equity", currency: "NGN", balance: 10_000_000_000, status: "active" },

  // Revenue
  { code: "4000", name: "Interest Income", type: "revenue", currency: "NGN", balance: 48_000_000_000, status: "active" },
  { code: "4100", name: "Fee and Commission Income", type: "revenue", currency: "NGN", balance: 12_000_000_000, status: "active" },
  { code: "4200", name: "Trading Income", type: "revenue", currency: "NGN", balance: 5_000_000_000, status: "active" },

  // Expenses
  { code: "5000", name: "Interest Expense", type: "expense", currency: "NGN", balance: 22_000_000_000, status: "active" },
  { code: "5100", name: "Operating Expenses", type: "expense", currency: "NGN", balance: 18_000_000_000, status: "active" },
  { code: "5200", name: "Provision for Loan Losses", type: "expense", currency: "NGN", balance: 8_000_000_000, status: "active" },
  { code: "5300", name: "Personnel Expenses", type: "expense", currency: "NGN", balance: 15_000_000_000, status: "active" },
];

// Seed journal entries (same rows the in-memory build shipped with).
const JOURNAL_SEED: JournalEntry[] = [
  {
    id: "JE-001",
    date: "2026-05-09",
    description: "Customer loan disbursement - Personal Loan",
    reference: "LN-2026-00451",
    entries: [
      { accountCode: "1210", accountName: "Personal Loans", debit: 5_000_000, credit: 0, currency: "NGN", narration: "Loan disbursement to CUST-001" },
      { accountCode: "2020", accountName: "Current Account Deposits", debit: 0, credit: 5_000_000, currency: "NGN", narration: "Credit customer current account" },
    ],
    status: "posted",
    postedBy: "system",
    postedAt: "2026-05-09T10:30:00Z",
  },
  {
    id: "JE-002",
    date: "2026-05-09",
    description: "Interest accrual on savings deposits",
    reference: "INT-ACCRUAL-20260509",
    entries: [
      { accountCode: "5000", accountName: "Interest Expense", debit: 2_450_000, credit: 0, currency: "NGN", narration: "Daily interest accrual" },
      { accountCode: "2010", accountName: "Savings Deposits", debit: 0, credit: 2_450_000, currency: "NGN", narration: "Interest payable to savings accounts" },
    ],
    status: "posted",
    postedBy: "batch-eod",
    postedAt: "2026-05-09T23:59:59Z",
  },
  {
    id: "JE-003",
    date: "2026-05-09",
    description: "NIP transfer - customer to external bank",
    reference: "NIP-2026050900123",
    entries: [
      { accountCode: "2020", accountName: "Current Account Deposits", debit: 1_500_000, credit: 0, currency: "NGN", narration: "Debit sender CUST-002" },
      { accountCode: "1000", accountName: "Cash and Balances with CBN", debit: 0, credit: 1_500_000, currency: "NGN", narration: "Nostro settlement" },
    ],
    status: "posted",
    postedBy: "nip-engine",
    postedAt: "2026-05-09T14:22:10Z",
  },
];

// ─── Schema (inline migration, fleet pattern) ───────────────────────────────

const GL_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS chart_of_accounts (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
    parent_code TEXT REFERENCES chart_of_accounts(code),
    currency TEXT NOT NULL DEFAULT 'NGN',
    balance NUMERIC(20,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS gl_journal_entries (
    id TEXT PRIMARY KEY,
    entry_date TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    reference TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed')),
    posted_by TEXT NOT NULL DEFAULT '',
    posted_at TIMESTAMPTZ,
    reversed_by TEXT,
    reversed_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS gl_journal_lines (
    id BIGSERIAL PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES gl_journal_entries(id),
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL DEFAULT '',
    debit NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN',
    narration TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_entry ON gl_journal_lines(entry_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_account ON gl_journal_lines(account_code)`,
  // Deferred balance-check trigger: Σdebits = Σcredits per entry, evaluated at
  // COMMIT so the header + all lines can be inserted in one transaction.
  `CREATE OR REPLACE FUNCTION gl_check_entry_balance() RETURNS trigger AS $fn$
   DECLARE d NUMERIC; c NUMERIC; eid TEXT;
   BEGIN
     eid := COALESCE(NEW.entry_id, OLD.entry_id);
     SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO d, c
       FROM gl_journal_lines WHERE entry_id = eid;
     IF ABS(d - c) > 0.005 THEN
       RAISE EXCEPTION 'gl_journal_entry % unbalanced: debit=% credit=%', eid, d, c;
     END IF;
     RETURN NULL;
   END $fn$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS gl_journal_lines_balance_trg ON gl_journal_lines`,
  `CREATE CONSTRAINT TRIGGER gl_journal_lines_balance_trg
     AFTER INSERT OR UPDATE OR DELETE ON gl_journal_lines
     DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
     EXECUTE FUNCTION gl_check_entry_balance()`,
];

async function ensureGlSchema(): Promise<void> {
  await ensureTables("doubleEntryLedger.gl", GL_DDL);
  // One-time seeds (idempotent).
  for (const a of CHART_OF_ACCOUNTS_SEED) {
    await exec(
      sql`INSERT INTO chart_of_accounts (code, name, type, parent_code, currency, balance, status)
          VALUES (${a.code}, ${a.name}, ${a.type}, ${a.parent ?? null}, ${a.currency}, ${a.balance}, ${a.status})
          ON CONFLICT (code) DO NOTHING`,
    );
  }
  for (const e of JOURNAL_SEED) {
    await insertJournalEntryTx(e, /*onConflictDoNothing*/ true);
  }
}

export function validateJournalBalance(entries: LedgerEntry[]): { valid: boolean; totalDebit: number; totalCredit: number; difference: number } {
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  return {
    valid: Math.abs(totalDebit - totalCredit) < 0.01,
    totalDebit,
    totalCredit,
    difference: Math.round((totalDebit - totalCredit) * 100) / 100,
  };
}

/** Insert header + lines in ONE transaction (deferred trigger checks at COMMIT). */
async function insertJournalEntryTx(entry: JournalEntry, onConflictDoNothing = false): Promise<void> {
  await withTx(async (run) => {
    await run(
      sql`INSERT INTO gl_journal_entries (id, entry_date, description, reference, status, posted_by, posted_at, reversed_by, reversed_at, metadata)
          VALUES (${entry.id}, ${entry.date}, ${entry.description}, ${entry.reference}, ${entry.status}, ${entry.postedBy},
                  ${entry.postedAt ?? null}, ${entry.reversedBy ?? null}, ${entry.reversedAt ?? null},
                  ${entry.metadata ? JSON.stringify(entry.metadata) : null}::jsonb)
          ${onConflictDoNothing ? sql`ON CONFLICT (id) DO NOTHING` : sql``}`,
    );
    if (onConflictDoNothing) {
      // Seed path: only insert lines when this entry had none (idempotent).
      await run(
        sql`INSERT INTO gl_journal_lines (entry_id, account_code, account_name, debit, credit, currency, narration)
            SELECT v.* FROM (VALUES ${sql.join(
              entry.entries.map(
                (l) => sql`(${entry.id}, ${l.accountCode}, ${l.accountName}, ${l.debit}, ${l.credit}, ${l.currency}, ${l.narration})`,
              ),
              sql`, `,
            )}) AS v(entry_id, account_code, account_name, debit, credit, currency, narration)
            WHERE EXISTS (SELECT 1 FROM gl_journal_entries WHERE id = ${entry.id})
              AND NOT EXISTS (SELECT 1 FROM gl_journal_lines WHERE entry_id = ${entry.id})`,
      );
    } else {
      for (const line of entry.entries) {
        await run(
          sql`INSERT INTO gl_journal_lines (entry_id, account_code, account_name, debit, credit, currency, narration)
              VALUES (${entry.id}, ${line.accountCode}, ${line.accountName}, ${line.debit}, ${line.credit}, ${line.currency}, ${line.narration})`,
        );
      }
    }
    // COMMIT (issued by the transaction wrapper) fires the deferred
    // balance-check trigger — an unbalanced entry aborts the whole tx.
  });
}

export async function computeTrialBalance(): Promise<{
  accounts: Array<{ code: string; name: string; type: string; debit: number; credit: number }>;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}> {
  await ensureGlSchema();
  const rows = await exec<{ code: string; name: string; type: string; balance: string | number }>(
    sql`SELECT code, name, type, balance::float8 AS balance FROM chart_of_accounts WHERE parent_code IS NULL ORDER BY code`,
  );
  const accounts = rows.map((a) => ({
    code: a.code,
    name: a.name,
    type: a.type,
    debit: ["asset", "expense"].includes(a.type) ? Number(a.balance) : 0,
    credit: ["liability", "equity", "revenue"].includes(a.type) ? Number(a.balance) : 0,
  }));

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

  return { accounts, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 1 };
}

export async function getChartOfAccounts(): Promise<ChartOfAccount[]> {
  await ensureGlSchema();
  const rows = await exec<{
    code: string; name: string; type: ChartOfAccount["type"]; parent_code: string | null;
    currency: string; balance: string | number; status: ChartOfAccount["status"];
  }>(sql`SELECT code, name, type, parent_code, currency, balance::float8 AS balance, status FROM chart_of_accounts ORDER BY code`);
  return rows.map((r) => ({
    code: r.code, name: r.name, type: r.type, parent: r.parent_code ?? undefined,
    currency: r.currency, balance: Number(r.balance), status: r.status,
  }));
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  await ensureGlSchema();
  const headers = await exec<{
    id: string; entry_date: string; description: string; reference: string; status: JournalEntry["status"];
    posted_by: string; posted_at: string | null; reversed_by: string | null; reversed_at: string | null;
    metadata: Record<string, unknown> | null;
  }>(sql`SELECT id, entry_date, description, reference, status, posted_by, posted_at, reversed_by, reversed_at, metadata
         FROM gl_journal_entries ORDER BY created_at ASC, id ASC`);
  const lines = await exec<{
    entry_id: string; account_code: string; account_name: string; debit: string | number;
    credit: string | number; currency: string; narration: string;
  }>(sql`SELECT entry_id, account_code, account_name, debit::float8 AS debit, credit::float8 AS credit, currency, narration
         FROM gl_journal_lines ORDER BY id ASC`);
  const byEntry = new Map<string, LedgerEntry[]>();
  for (const l of lines) {
    const arr = byEntry.get(l.entry_id) ?? [];
    arr.push({ accountCode: l.account_code, accountName: l.account_name, debit: Number(l.debit), credit: Number(l.credit), currency: l.currency, narration: l.narration });
    byEntry.set(l.entry_id, arr);
  }
  return headers.map((h) => ({
    id: h.id, date: h.entry_date, description: h.description, reference: h.reference,
    entries: byEntry.get(h.id) ?? [], status: h.status, postedBy: h.posted_by,
    postedAt: h.posted_at ?? undefined, reversedBy: h.reversed_by ?? undefined,
    reversedAt: h.reversed_at ?? undefined, metadata: h.metadata ?? undefined,
  }));
}

/**
 * Persist a journal entry (header + lines) atomically. Throws if the entry is
 * unbalanced (app-level check + DB deferred trigger) so callers can mark the
 * entry failed instead of leaving a half-posted state.
 */
export async function addJournalEntry(entry: JournalEntry): Promise<void> {
  await ensureGlSchema();
  const balance = validateJournalBalance(entry.entries);
  if (!balance.valid) {
    throw new Error(`journal entry ${entry.id} unbalanced: debit=${balance.totalDebit} credit=${balance.totalCredit}`);
  }
  await insertJournalEntryTx(entry);
}

/** Transition an entry's status (e.g. pending → posted after durable save). */
export async function updateJournalEntryStatus(id: string, status: JournalEntry["status"]): Promise<void> {
  await ensureGlSchema();
  await exec(
    sql`UPDATE gl_journal_entries SET status = ${status}, posted_at = CASE WHEN ${status} = 'posted' THEN NOW() ELSE posted_at END WHERE id = ${id}`,
  );
}
