/**
 * Document Management / OCR — KYC document upload, verification, storage.
 * Nigerian ID verification (BVN, NIN, voter's card, driver's license),
 * document classification, OCR extraction, and tamper detection.
 */
import type { Express, Request, Response } from "express";

interface Document {
  id: string; tenantId: string; customerId: string; type: string; subType: string;
  fileName: string; mimeType: string; sizeBytes: number; ocrExtracted: boolean;
  extractedData: Record<string, unknown>; verificationStatus: string;
  tamperScore: number; storagePath: string; uploadedAt: string; verifiedAt?: string;
}

interface VerificationProvider { name: string; types: string[]; avgResponseMs: number; successRate: number; status: string; }

const DOCUMENTS: Document[] = [
  { id: "DOC-001", tenantId: "TEN-GTBANK", customerId: "CUST-GT-001", type: "national_id", subType: "nin_slip", fileName: "nin_aliko_dangote.pdf", mimeType: "application/pdf", sizeBytes: 245000, ocrExtracted: true, extractedData: { nin: "12345678901", fullName: "Aliko Dangote", dob: "1957-04-10", gender: "M", state: "Kano" }, verificationStatus: "verified", tamperScore: 0.02, storagePath: "s3://54bank-docs/TEN-GTBANK/CUST-GT-001/nin_slip.pdf", uploadedAt: "2026-01-15T10:00:00Z", verifiedAt: "2026-01-15T10:05:00Z" },
  { id: "DOC-002", tenantId: "TEN-GTBANK", customerId: "CUST-GT-001", type: "utility_bill", subType: "electricity", fileName: "phcn_bill_jan2026.pdf", mimeType: "application/pdf", sizeBytes: 180000, ocrExtracted: true, extractedData: { provider: "Eko Electricity", address: "42 Marina Road, Lagos Island", amount: 45000, period: "January 2026" }, verificationStatus: "verified", tamperScore: 0.05, storagePath: "s3://54bank-docs/TEN-GTBANK/CUST-GT-001/utility_bill.pdf", uploadedAt: "2026-01-15T10:01:00Z", verifiedAt: "2026-01-15T10:10:00Z" },
  { id: "DOC-003", tenantId: "TEN-FIRSTBANK", customerId: "CUST-FB-001", type: "national_id", subType: "voters_card", fileName: "voters_card_adewale.jpg", mimeType: "image/jpeg", sizeBytes: 520000, ocrExtracted: true, extractedData: { vin: "90F5AB123456789012345", fullName: "Adewale Johnson", state: "Lagos", lga: "Surulere" }, verificationStatus: "verified", tamperScore: 0.01, storagePath: "s3://54bank-docs/TEN-FIRSTBANK/CUST-FB-001/voters_card.jpg", uploadedAt: "2026-02-01T08:00:00Z", verifiedAt: "2026-02-01T08:03:00Z" },
  { id: "DOC-004", tenantId: "TEN-WEMA", customerId: "CUST-WEMA-001", type: "drivers_license", subType: "frsc", fileName: "drivers_license.jpg", mimeType: "image/jpeg", sizeBytes: 450000, ocrExtracted: true, extractedData: { licenseNo: "FKJ12345AB67", fullName: "Chidinma Okafor", dob: "1990-07-22", expiryDate: "2028-07-22", class: "B" }, verificationStatus: "verified", tamperScore: 0.03, storagePath: "s3://54bank-docs/TEN-WEMA/CUST-WEMA-001/drivers_license.jpg", uploadedAt: "2026-03-15T09:00:00Z", verifiedAt: "2026-03-15T09:02:00Z" },
  { id: "DOC-005", tenantId: "TEN-MUTUAL-MFB", customerId: "CUST-MFB-001", type: "passport_photo", subType: "selfie", fileName: "selfie_amina.jpg", mimeType: "image/jpeg", sizeBytes: 320000, ocrExtracted: false, extractedData: { livenessScore: 0.98, faceMatchScore: 0.95 }, verificationStatus: "verified", tamperScore: 0.01, storagePath: "s3://54bank-docs/TEN-MUTUAL-MFB/CUST-MFB-001/selfie.jpg", uploadedAt: "2026-04-01T07:00:00Z", verifiedAt: "2026-04-01T07:01:00Z" },
  { id: "DOC-006", tenantId: "TEN-GTBANK", customerId: "CUST-GT-002", type: "corporate", subType: "cac_certificate", fileName: "cac_bua_group.pdf", mimeType: "application/pdf", sizeBytes: 380000, ocrExtracted: true, extractedData: { rcNumber: "RC-12345", companyName: "BUA Group", incorporationDate: "1988-03-15", registeredAddress: "Plot 123, Ozumba Mbadiwe, VI, Lagos" }, verificationStatus: "verified", tamperScore: 0.02, storagePath: "s3://54bank-docs/TEN-GTBANK/CUST-GT-002/cac_certificate.pdf", uploadedAt: "2026-01-20T11:00:00Z", verifiedAt: "2026-01-20T11:15:00Z" },
];

const PROVIDERS: VerificationProvider[] = [
  { name: "VerifyMe Nigeria", types: ["bvn", "nin", "drivers_license", "voters_card"], avgResponseMs: 2500, successRate: 98.5, status: "active" },
  { name: "Smile Identity", types: ["selfie_liveness", "face_match", "id_verification"], avgResponseMs: 3200, successRate: 97.8, status: "active" },
  { name: "Youverify", types: ["address_verification", "cac_verification"], avgResponseMs: 4500, successRate: 96.2, status: "active" },
  { name: "Prembly (Identitypass)", types: ["bvn", "nin", "phone_verification", "credit_check"], avgResponseMs: 1800, successRate: 99.1, status: "active" },
];

export function registerDocumentManagement(app: Express) {
  app.get("/api/documents/v1/files", (_req: Request, res: Response) => { res.json({ items: DOCUMENTS, total: DOCUMENTS.length }); });
  app.get("/api/documents/v1/files/:id", (req: Request, res: Response) => {
    const d = DOCUMENTS.find((x) => x.id === req.params.id);
    d ? res.json(d) : res.status(404).json({ error: "Document not found" });
  });
  app.post("/api/documents/v1/upload", (req: Request, res: Response) => {
    const { customerId, type, subType, fileName } = req.body ?? {};
    const doc: Document = { id: `DOC-${String(DOCUMENTS.length + 1).padStart(3, "0")}`, tenantId: (req.headers["x-tenant-id"] as string) ?? "TEN-PLATFORM-ADMIN", customerId: customerId ?? "CUST-NEW", type: type ?? "other", subType: subType ?? "unknown", fileName: fileName ?? "document.pdf", mimeType: "application/pdf", sizeBytes: 250000, ocrExtracted: false, extractedData: {}, verificationStatus: "pending_ocr", tamperScore: 0, storagePath: `s3://54bank-docs/${customerId}/${fileName}`, uploadedAt: new Date().toISOString() };
    DOCUMENTS.push(doc);
    res.status(201).json(doc);
  });
  app.get("/api/documents/v1/providers", (_req: Request, res: Response) => { res.json({ items: PROVIDERS, total: PROVIDERS.length }); });
  app.get("/api/documents/v1/stats", (_req: Request, res: Response) => {
    res.json({ totalDocuments: DOCUMENTS.length, verified: DOCUMENTS.filter((d) => d.verificationStatus === "verified").length, pending: DOCUMENTS.filter((d) => d.verificationStatus !== "verified").length, ocrProcessed: DOCUMENTS.filter((d) => d.ocrExtracted).length, avgTamperScore: 0.023, providers: PROVIDERS.length, totalStorageBytes: DOCUMENTS.reduce((s, d) => s + d.sizeBytes, 0) });
  });
}
