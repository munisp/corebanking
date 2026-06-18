// LC Amendment Lifecycle — Letter of Credit amendment workflow with SWIFT MT707 messaging
import type { Express, Request, Response } from "express";

interface LCAmendment {
  id: string;
  lcNumber: string;
  amendmentNumber: number;
  requestedBy: string;
  amendmentType: string;
  description: string;
  originalValue: string;
  amendedValue: string;
  impactOnAmount: number;
  currency: string;
  swiftRef: string;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  issuedAt: string | null;
  advisedAt: string | null;
  beneficiaryAcceptedAt: string | null;
}

const amendments: LCAmendment[] = [
  {
    id: "AMND-001", lcNumber: "LC-2026-0042", amendmentNumber: 1,
    requestedBy: "Dangote Cement PLC", amendmentType: "amount_increase",
    description: "Increase LC value by $500K due to additional cargo",
    originalValue: "$2,000,000", amendedValue: "$2,500,000",
    impactOnAmount: 500000, currency: "USD",
    swiftRef: "MT707-AMND-001-2026",
    status: "beneficiary_accepted",
    requestedAt: "2026-05-01T09:00:00Z", approvedAt: "2026-05-01T14:00:00Z",
    issuedAt: "2026-05-02T10:00:00Z", advisedAt: "2026-05-02T16:00:00Z",
    beneficiaryAcceptedAt: "2026-05-03T11:00:00Z",
  },
  {
    id: "AMND-002", lcNumber: "LC-2026-0055", amendmentNumber: 1,
    requestedBy: "BUA Group", amendmentType: "expiry_extension",
    description: "Extend LC expiry by 30 days due to shipping delay",
    originalValue: "2026-06-15", amendedValue: "2026-07-15",
    impactOnAmount: 0, currency: "USD",
    swiftRef: "MT707-AMND-002-2026",
    status: "pending_approval",
    requestedAt: "2026-05-05T10:00:00Z", approvedAt: null,
    issuedAt: null, advisedAt: null, beneficiaryAcceptedAt: null,
  },
  {
    id: "AMND-003", lcNumber: "LC-2026-0042", amendmentNumber: 2,
    requestedBy: "Dangote Cement PLC", amendmentType: "document_change",
    description: "Change inspection certificate issuer from SGS to Bureau Veritas",
    originalValue: "SGS Nigeria", amendedValue: "Bureau Veritas",
    impactOnAmount: 0, currency: "USD",
    swiftRef: "MT707-AMND-003-2026",
    status: "issued",
    requestedAt: "2026-05-06T08:00:00Z", approvedAt: "2026-05-06T11:00:00Z",
    issuedAt: "2026-05-07T09:00:00Z", advisedAt: null, beneficiaryAcceptedAt: null,
  },
  {
    id: "AMND-004", lcNumber: "LC-2026-0078", amendmentNumber: 1,
    requestedBy: "Flour Mills Nigeria", amendmentType: "partial_shipment",
    description: "Allow partial shipment (originally prohibited)",
    originalValue: "Partial shipment NOT allowed", amendedValue: "Partial shipment ALLOWED",
    impactOnAmount: 0, currency: "USD",
    swiftRef: "MT707-AMND-004-2026",
    status: "rejected",
    requestedAt: "2026-05-04T12:00:00Z", approvedAt: null,
    issuedAt: null, advisedAt: null, beneficiaryAcceptedAt: null,
  },
  {
    id: "AMND-005", lcNumber: "LC-2026-0090", amendmentNumber: 1,
    requestedBy: "Nigerian Breweries", amendmentType: "beneficiary_change",
    description: "Change beneficiary from Siemens AG to Siemens Energy AG (corporate restructuring)",
    originalValue: "Siemens AG, Munich", amendedValue: "Siemens Energy AG, Munich",
    impactOnAmount: 0, currency: "EUR",
    swiftRef: "MT707-AMND-005-2026",
    status: "advised",
    requestedAt: "2026-05-07T10:00:00Z", approvedAt: "2026-05-07T15:00:00Z",
    issuedAt: "2026-05-08T09:00:00Z", advisedAt: "2026-05-08T14:00:00Z",
    beneficiaryAcceptedAt: null,
  },
];

const LIFECYCLE_STAGES = [
  "draft", "pending_approval", "approved", "issued", "advised",
  "beneficiary_accepted", "rejected", "cancelled"
];

export function registerLCAmendmentRoutes(app: Express): void {
  app.get("/api/platform/trade-finance/lc-amendments/lifecycle-stages", (_req: Request, res: Response) => {
    res.json({ stages: LIFECYCLE_STAGES, count: LIFECYCLE_STAGES.length });
  });

  app.get("/api/platform/trade-finance/lc-amendments/stats", (_req: Request, res: Response) => {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalAmountImpact = 0;
    for (const a of amendments) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      byType[a.amendmentType] = (byType[a.amendmentType] || 0) + 1;
      totalAmountImpact += a.impactOnAmount;
    }
    res.json({
      total: amendments.length,
      byStatus, byType, totalAmountImpact,
      avgProcessingDays: 2.3,
    });
  });

  app.get("/api/platform/trade-finance/lc-amendments/by-lc/:lcNumber", (req: Request, res: Response) => {
    const lcAmendments = amendments.filter(a => a.lcNumber === req.params.lcNumber);
    res.json({ items: lcAmendments, total: lcAmendments.length, lcNumber: req.params.lcNumber });
  });

  app.get("/api/platform/trade-finance/lc-amendments", (_req: Request, res: Response) => {
    res.json({ items: amendments, total: amendments.length });
  });

  app.post("/api/platform/trade-finance/lc-amendments", (req: Request, res: Response) => {
    const { lcNumber, requestedBy, amendmentType, description, originalValue, amendedValue, impactOnAmount, currency } = req.body;
    if (!lcNumber || !amendmentType || !description) {
      return res.status(400).json({ error: "lcNumber, amendmentType, and description are required" });
    }
    const validTypes = ["amount_increase", "amount_decrease", "expiry_extension", "document_change", "partial_shipment", "beneficiary_change", "port_change", "terms_change"];
    if (!validTypes.includes(amendmentType)) {
      return res.status(400).json({ error: `Invalid amendment type. Valid: ${validTypes.join(", ")}` });
    }
    const existingForLC = amendments.filter(a => a.lcNumber === lcNumber);
    const newAmendment: LCAmendment = {
      id: `AMND-${String(amendments.length + 1).padStart(3, "0")}`,
      lcNumber, amendmentNumber: existingForLC.length + 1,
      requestedBy: requestedBy || "Unknown",
      amendmentType, description,
      originalValue: originalValue || "", amendedValue: amendedValue || "",
      impactOnAmount: impactOnAmount || 0, currency: currency || "USD",
      swiftRef: `MT707-AMND-${String(amendments.length + 1).padStart(3, "0")}-2026`,
      status: "pending_approval",
      requestedAt: new Date().toISOString(),
      approvedAt: null, issuedAt: null, advisedAt: null, beneficiaryAcceptedAt: null,
    };
    amendments.push(newAmendment);
    res.status(201).json(newAmendment);
  });

  app.get("/api/platform/trade-finance/lc-amendments/:id", (req: Request, res: Response) => {
    const amnd = amendments.find(a => a.id === req.params.id);
    if (!amnd) return res.status(404).json({ error: "Amendment not found" });
    res.json(amnd);
  });
}
