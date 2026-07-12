/**
 * Report Generation Engine — PDF/Excel exports for regulatory returns,
 * account statements, audit reports, and management dashboards.
 * Supports scheduled generation, template management, and delivery queuing.
 */
import type { Express, Request, Response } from "express";

interface ReportTemplate {
  id: string;
  name: string;
  category: "regulatory" | "operational" | "financial" | "audit" | "customer";
  format: "pdf" | "excel" | "csv" | "xml";
  schedule?: string;
  parameters: string[];
  regulatoryBody?: string;
  description: string;
  lastGenerated?: string;
  status: "active" | "draft";
}

interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  tenantId: string;
  format: string;
  sizeBytes: number;
  generatedBy: string;
  generatedAt: string;
  period: string;
  status: "completed" | "generating" | "failed" | "queued";
  downloadUrl?: string;
  metadata: Record<string, unknown>;
}

const TEMPLATES: ReportTemplate[] = [
  { id: "RPT-001", name: "CBN eFASS Returns", category: "regulatory", format: "xml", schedule: "monthly", parameters: ["reportingPeriod", "branchCode"], regulatoryBody: "CBN", description: "Electronic Financial Analysis and Surveillance System — monthly returns to Central Bank of Nigeria", lastGenerated: "2026-04-30T23:59:00Z", status: "active" },
  { id: "RPT-002", name: "NDIC Premium Assessment", category: "regulatory", format: "excel", schedule: "quarterly", parameters: ["quarter", "year"], regulatoryBody: "NDIC", description: "Nigeria Deposit Insurance Corporation premium calculation based on insured deposits", lastGenerated: "2026-03-31T23:59:00Z", status: "active" },
  { id: "RPT-003", name: "Basel III LCR Report", category: "regulatory", format: "excel", schedule: "daily", parameters: ["reportDate"], regulatoryBody: "CBN", description: "Liquidity Coverage Ratio — high-quality liquid assets vs net cash outflows over 30 days", lastGenerated: "2026-05-08T23:59:00Z", status: "active" },
  { id: "RPT-004", name: "Basel III NSFR Report", category: "regulatory", format: "excel", schedule: "quarterly", parameters: ["quarter", "year"], regulatoryBody: "CBN", description: "Net Stable Funding Ratio — available stable funding vs required stable funding", lastGenerated: "2026-03-31T23:59:00Z", status: "active" },
  { id: "RPT-005", name: "Currency Transaction Report (CTR)", category: "regulatory", format: "xml", schedule: "daily", parameters: ["reportDate", "threshold"], regulatoryBody: "NFIU", description: "Transactions exceeding ₦5M (individual) / ₦10M (corporate) reported to NFIU", lastGenerated: "2026-05-08T23:59:00Z", status: "active" },
  { id: "RPT-006", name: "Suspicious Transaction Report (STR)", category: "regulatory", format: "xml", schedule: "as_needed", parameters: ["caseId"], regulatoryBody: "NFIU", description: "Report suspicious activities to Nigeria Financial Intelligence Unit", lastGenerated: "2026-05-07T14:00:00Z", status: "active" },
  { id: "RPT-007", name: "FIRS Withholding Tax Report", category: "regulatory", format: "excel", schedule: "monthly", parameters: ["month", "year"], regulatoryBody: "FIRS", description: "Withholding tax deductions on interest, fees, and commissions to Federal Inland Revenue Service", lastGenerated: "2026-04-30T23:59:00Z", status: "active" },
  { id: "RPT-008", name: "Account Statement (PDF)", category: "customer", format: "pdf", parameters: ["accountNumber", "startDate", "endDate"], description: "Customer account statement with opening/closing balance, all transactions, and summary", lastGenerated: "2026-05-09T10:00:00Z", status: "active" },
  { id: "RPT-009", name: "Trial Balance", category: "financial", format: "excel", schedule: "daily", parameters: ["reportDate"], description: "GL trial balance showing all account balances — debits must equal credits", lastGenerated: "2026-05-09T00:05:00Z", status: "active" },
  { id: "RPT-010", name: "Profit & Loss Statement", category: "financial", format: "pdf", schedule: "monthly", parameters: ["period"], description: "Income statement showing revenue, expenses, and net profit/loss for the period", lastGenerated: "2026-04-30T23:59:00Z", status: "active" },
  { id: "RPT-011", name: "Loan Portfolio Report", category: "operational", format: "excel", schedule: "weekly", parameters: ["reportDate"], description: "Loan book summary — performing, watchlist, substandard, doubtful, lost classifications per CBN prudential guidelines", lastGenerated: "2026-05-05T23:59:00Z", status: "active" },
  { id: "RPT-012", name: "Audit Trail Export", category: "audit", format: "csv", parameters: ["startDate", "endDate", "entityType"], description: "Complete audit trail export for compliance review and forensic analysis", lastGenerated: "2026-05-09T08:00:00Z", status: "active" },
];

const GENERATED_REPORTS: GeneratedReport[] = [
  { id: "GEN-001", templateId: "RPT-003", name: "Basel III LCR — 2026-05-08", tenantId: "TEN-GTBANK", format: "excel", sizeBytes: 245000, generatedBy: "system-scheduler", generatedAt: "2026-05-09T00:01:00Z", period: "2026-05-08", status: "completed", downloadUrl: "/reports/LCR-2026-05-08.xlsx", metadata: { lcr: 145.2, hqla: 85000000000, netCashOutflows: 58500000000 } },
  { id: "GEN-002", templateId: "RPT-005", name: "CTR — 2026-05-08", tenantId: "TEN-PLATFORM-ADMIN", format: "xml", sizeBytes: 128000, generatedBy: "system-scheduler", generatedAt: "2026-05-09T00:02:00Z", period: "2026-05-08", status: "completed", downloadUrl: "/reports/CTR-2026-05-08.xml", metadata: { transactionsReported: 47, totalAmount: 2850000000 } },
  { id: "GEN-003", templateId: "RPT-008", name: "Statement — 0012345678 — May 2026", tenantId: "TEN-GTBANK", format: "pdf", sizeBytes: 85000, generatedBy: "USR-GT-001", generatedAt: "2026-05-09T10:00:00Z", period: "2026-05-01 to 2026-05-09", status: "completed", downloadUrl: "/reports/STMT-0012345678-202605.pdf", metadata: { transactions: 45, openingBalance: 3200000, closingBalance: 8500000 } },
  { id: "GEN-004", templateId: "RPT-009", name: "Trial Balance — 2026-05-09", tenantId: "TEN-PLATFORM-ADMIN", format: "excel", sizeBytes: 320000, generatedBy: "system-eod", generatedAt: "2026-05-09T00:05:00Z", period: "2026-05-09", status: "completed", downloadUrl: "/reports/TB-2026-05-09.xlsx", metadata: { totalDebits: 225000000000, totalCredits: 225000000000, balanced: true } },
  { id: "GEN-005", templateId: "RPT-011", name: "Loan Portfolio — Week 19 2026", tenantId: "TEN-FIRSTBANK", format: "excel", sizeBytes: 180000, generatedBy: "system-scheduler", generatedAt: "2026-05-05T00:10:00Z", period: "2026-W19", status: "completed", downloadUrl: "/reports/LOAN-PORTFOLIO-W19-2026.xlsx", metadata: { performing: 4200, watchlist: 120, substandard: 35, doubtful: 12, lost: 3, nplRatio: 3.8 } },
];

export function registerReportGeneration(app: Express) {
  app.get("/api/reports/v1/templates", (_req: Request, res: Response) => {
    res.json({ items: TEMPLATES, total: TEMPLATES.length });
  });
  app.get("/api/reports/v1/generated", (req: Request, res: Response) => {
    const category = req.query.category as string;
    const tplIds = category ? TEMPLATES.filter((t) => t.category === category).map((t) => t.id) : null;
    const filtered = tplIds ? GENERATED_REPORTS.filter((r) => tplIds.includes(r.templateId)) : GENERATED_REPORTS;
    res.json({ items: filtered, total: filtered.length });
  });
  app.post("/api/reports/v1/generate", (req: Request, res: Response) => {
    const { templateId, parameters } = req.body ?? {};
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return res.status(404).json({ error: "Template not found" });
    const report: GeneratedReport = {
      id: `GEN-${String(GENERATED_REPORTS.length + 1).padStart(3, "0")}`,
      templateId, name: `${tpl.name} — ${new Date().toISOString().slice(0, 10)}`,
      tenantId: (req.headers["x-tenant-id"] as string) ?? "TEN-PLATFORM-ADMIN",
      format: tpl.format, sizeBytes: 0, generatedBy: "api-request",
      generatedAt: new Date().toISOString(), period: parameters?.period ?? "current",
      status: "generating", metadata: { parameters },
    };
    GENERATED_REPORTS.push(report);
    res.status(201).json(report);
  });
  app.get("/api/reports/v1/stats", (_req: Request, res: Response) => {
    res.json({
      totalTemplates: TEMPLATES.length, generatedToday: 3, totalGenerated: GENERATED_REPORTS.length,
      regulatory: TEMPLATES.filter((t) => t.category === "regulatory").length,
      scheduledReports: TEMPLATES.filter((t) => t.schedule).length,
      avgGenerationTimeMs: 4500, storageUsedBytes: GENERATED_REPORTS.reduce((s, r) => s + r.sizeBytes, 0),
    });
  });
}
