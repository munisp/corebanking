// B10: Account Statement Enhancement — PDF, MT940, Email, Tax Certificate
import type { Express, Request, Response } from "express";

interface StatementRequest { id: string; accountId: string; format: string; period: string; status: string; generatedAt: string; deliveryChannel: string; }

const statementHistory: StatementRequest[] = [
  { id: "STM-001", accountId: "0012345678", format: "pdf", period: "2026-04", status: "delivered", generatedAt: "2026-05-01T06:00:00Z", deliveryChannel: "email" },
  { id: "STM-002", accountId: "0012345678", format: "mt940", period: "2026-04", status: "delivered", generatedAt: "2026-05-01T06:00:00Z", deliveryChannel: "sftp" },
  { id: "STM-003", accountId: "0098765432", format: "pdf", period: "2026-03", status: "delivered", generatedAt: "2026-04-01T06:00:00Z", deliveryChannel: "email" },
  { id: "STM-004", accountId: "0098765432", format: "csv", period: "2026-04", status: "processing", generatedAt: "2026-05-01T08:00:00Z", deliveryChannel: "download" },
  { id: "STM-005", accountId: "0055667788", format: "tax_certificate", period: "2025", status: "delivered", generatedAt: "2026-01-15T10:00:00Z", deliveryChannel: "email" },
];

export function registerAccountStatementEnhancement(app: Express) {
  app.get("/api/platform/statements/history", (_: Request, res: Response) => {
    res.json({ items: statementHistory, total: statementHistory.length });
  });

  app.post("/api/platform/statements/generate", (req: Request, res: Response) => {
    const { accountId, format, startDate, endDate } = req.body || {};
    if (!accountId || !format) return res.status(400).json({ error: "accountId and format required" });
    const validFormats = ["pdf", "csv", "mt940", "excel", "tax_certificate"];
    if (!validFormats.includes(format)) return res.status(400).json({ error: `Invalid format. Valid: ${validFormats.join(", ")}` });
    const stmt: StatementRequest = {
      id: `STM-${Date.now()}`, accountId, format,
      period: `${startDate || "2026-04-01"} to ${endDate || "2026-04-30"}`,
      status: "processing", generatedAt: new Date().toISOString(), deliveryChannel: "download",
    };
    statementHistory.push(stmt);
    res.json({ ...stmt, estimated_time_seconds: format === "pdf" ? 5 : format === "mt940" ? 3 : 2 });
  });

  app.get("/api/platform/statements/mt940-sample", (_: Request, res: Response) => {
    const mt940 = `:20:STMT260501
:25:54BANK/0012345678
:28C:00001/001
:60F:C260401NGN1500000000,00
:61:2604010401DN500000,00NTRF54BANK-TXN-001
:86:Transfer to vendor - Office supplies
:61:2604050405CR2000000,00NTRF54BANK-TXN-002
:86:Salary credit - April 2026
:62F:C260430NGN3000000000,00
:64:C260430NGN3000000000,00`;
    res.type("text/plain").send(mt940);
  });

  app.get("/api/platform/statements/formats", (_: Request, res: Response) => {
    res.json({
      formats: [
        { id: "pdf", name: "PDF Statement", description: "Formatted with 54Bank letterhead and watermark", supports_schedule: true },
        { id: "csv", name: "CSV Export", description: "Comma-separated values for spreadsheet import", supports_schedule: true },
        { id: "mt940", name: "SWIFT MT940", description: "SWIFT-compliant format for corporate clients and ERPs", supports_schedule: true },
        { id: "excel", name: "Excel Workbook", description: "Multi-sheet workbook with pivot tables", supports_schedule: false },
        { id: "tax_certificate", name: "Tax Certificate", description: "Annual interest certificate for FIRS tax filing", supports_schedule: false },
      ],
    });
  });
}
