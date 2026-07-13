// Cheque Imaging & Truncation — Digital cheque processing with MICR/OCR and image-based clearing
import type { Express, Request, Response } from "express";

interface ChequeImage {
  id: string;
  chequeNumber: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  amount: number;
  currency: string;
  payeeName: string;
  drawerName: string;
  micrLine: string;
  frontImageRef: string;
  backImageRef: string;
  ocrConfidence: number;
  ocrExtractedAmount: number;
  amountMatch: boolean;
  signatureVerified: boolean;
  truncatedAt: string;
  clearingStatus: string;
  clearingCycle: string;
  returnReason: string | null;
  processedBy: string;
}

const chequeImages: ChequeImage[] = [
  {
    id: "CHQ-IMG-001", chequeNumber: "000145", bankCode: "058", branchCode: "001",
    accountNumber: "0012345678", amount: 2500000, currency: "NGN",
    payeeName: "Ade Okonkwo Enterprises", drawerName: "Fatima Abdullahi",
    micrLine: "C000145C A058001A 0012345678C",
    frontImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-001-front.tiff",
    backImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-001-back.tiff",
    ocrConfidence: 0.97, ocrExtractedAmount: 2500000, amountMatch: true,
    signatureVerified: true, truncatedAt: "2026-05-08T09:15:00Z",
    clearingStatus: "cleared", clearingCycle: "T+1",
    returnReason: null, processedBy: "auto-scanner-lekki-001",
  },
  {
    id: "CHQ-IMG-002", chequeNumber: "000289", bankCode: "044", branchCode: "012",
    accountNumber: "0098765432", amount: 15000000, currency: "NGN",
    payeeName: "BUA Foods PLC", drawerName: "Ibrahim Musa Trading",
    micrLine: "C000289C A044012A 0098765432C",
    frontImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-002-front.tiff",
    backImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-002-back.tiff",
    ocrConfidence: 0.92, ocrExtractedAmount: 15000000, amountMatch: true,
    signatureVerified: true, truncatedAt: "2026-05-08T10:30:00Z",
    clearingStatus: "cleared", clearingCycle: "T+1",
    returnReason: null, processedBy: "auto-scanner-vi-002",
  },
  {
    id: "CHQ-IMG-003", chequeNumber: "000456", bankCode: "011", branchCode: "005",
    accountNumber: "0055667788", amount: 750000, currency: "NGN",
    payeeName: "Chinedu Supplies Ltd", drawerName: "Access Bank Customer",
    micrLine: "C000456C A011005A 0055667788C",
    frontImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-003-front.tiff",
    backImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-003-back.tiff",
    ocrConfidence: 0.68, ocrExtractedAmount: 730000, amountMatch: false,
    signatureVerified: false, truncatedAt: "2026-05-09T08:00:00Z",
    clearingStatus: "returned", clearingCycle: "T+1",
    returnReason: "OCR_AMOUNT_MISMATCH", processedBy: "auto-scanner-ikeja-003",
  },
  {
    id: "CHQ-IMG-004", chequeNumber: "000678", bankCode: "058", branchCode: "003",
    accountNumber: "0033445566", amount: 500000, currency: "NGN",
    payeeName: "Self", drawerName: "Ngozi Eze",
    micrLine: "C000678C A058003A 0033445566C",
    frontImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-004-front.tiff",
    backImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-004-back.tiff",
    ocrConfidence: 0.99, ocrExtractedAmount: 500000, amountMatch: true,
    signatureVerified: true, truncatedAt: "2026-05-09T09:45:00Z",
    clearingStatus: "pending", clearingCycle: "T+0",
    returnReason: null, processedBy: "auto-scanner-lekki-001",
  },
  {
    id: "CHQ-IMG-005", chequeNumber: "000890", bankCode: "033", branchCode: "001",
    accountNumber: "0077889900", amount: 50000000, currency: "NGN",
    payeeName: "Julius Berger Nigeria PLC", drawerName: "Federal Ministry of Works",
    micrLine: "C000890C A033001A 0077889900C",
    frontImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-005-front.tiff",
    backImageRef: "s3://54bank-cheques/2026/05/CHQ-IMG-005-back.tiff",
    ocrConfidence: 0.95, ocrExtractedAmount: 50000000, amountMatch: true,
    signatureVerified: true, truncatedAt: "2026-05-09T11:00:00Z",
    clearingStatus: "manual_review", clearingCycle: "T+2",
    returnReason: null, processedBy: "manual-review-queue",
  },
];

export function registerChequeImagingRoutes(app: Express): void {
  app.get("/api/platform/cheque-imaging/images", (_req: Request, res: Response) => {
    res.json({ items: chequeImages, total: chequeImages.length });
  });

  app.get("/api/platform/cheque-imaging/images/:id", (req: Request, res: Response) => {
    const img = chequeImages.find(c => c.id === req.params.id);
    if (!img) return res.status(404).json({ error: "Cheque image not found" });
    res.json(img);
  });

  app.get("/api/platform/cheque-imaging/stats", (_req: Request, res: Response) => {
    const cleared = chequeImages.filter(c => c.clearingStatus === "cleared").length;
    const returned = chequeImages.filter(c => c.clearingStatus === "returned").length;
    const pending = chequeImages.filter(c => c.clearingStatus === "pending").length;
    const manualReview = chequeImages.filter(c => c.clearingStatus === "manual_review").length;
    const avgOCR = chequeImages.reduce((s, c) => s + c.ocrConfidence, 0) / chequeImages.length;
    const amountMismatches = chequeImages.filter(c => !c.amountMatch).length;
    const signatureFailures = chequeImages.filter(c => !c.signatureVerified).length;
    const totalValue = chequeImages.filter(c => c.clearingStatus === "cleared").reduce((s, c) => s + c.amount, 0);

    res.json({
      total: chequeImages.length, cleared, returned, pending, manualReview,
      avgOCRConfidence: Math.round(avgOCR * 100) / 100,
      amountMismatches, signatureFailures, totalClearedValue: totalValue,
      clearingRates: { t0: pending, t1: cleared + returned, t2: manualReview },
    });
  });

  app.post("/api/platform/cheque-imaging/validate-micr", (req: Request, res: Response) => {
    const { micrLine } = req.body;
    if (!micrLine) return res.status(400).json({ error: "micrLine is required" });
    const micrPattern = /^C(\d{6})C\s+A(\d{6})A\s+(\d{10})C$/;
    const match = micrLine.match(micrPattern);
    if (!match) return res.json({ valid: false, error: "Invalid MICR format", expected: "C<chequeNo>C A<bankBranch>A <account>C" });
    res.json({
      valid: true, chequeNumber: match[1], bankBranchCode: match[2],
      accountNumber: match[3], bankCode: match[2].substring(0, 3),
      branchCode: match[2].substring(3, 6),
    });
  });
}
