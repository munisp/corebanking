import { Router } from "express";
import { asyncHandler } from "../../middlewares/async";
import { billingDashboardController } from "../../controllers/billingDashboardController";
import { billingAccountController } from "../../controllers/billingAccountController";
import { billingRateCardController } from "../../controllers/billingRateCardController";
import { billingUsageEventController } from "../../controllers/billingUsageEventController";
import { billingInvoiceController } from "../../controllers/billingInvoiceController";
import { billingContractController } from "../../controllers/billingContractController";
import { billingApprovalMatrixController } from "../../controllers/billingApprovalMatrixController";
import { billingDisputeController } from "../../controllers/billingDisputeController";
import { billingErpController } from "../../controllers/billingErpController";

const router = Router();

// ─── Profile & info (Dapr + direct HTTP consumers) ────────────────────────────
router.get("/status", asyncHandler(billingDashboardController.getStatus.bind(billingDashboardController)));
router.get("/info", asyncHandler(billingAccountController.getBillingInfo.bind(billingAccountController)));
router.put("/", asyncHandler(billingAccountController.createProfile.bind(billingAccountController)));

// ─── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/dashboard/extended", asyncHandler(billingDashboardController.getExtendedDashboard.bind(billingDashboardController)));
router.get("/dashboard", asyncHandler(billingDashboardController.getDashboard.bind(billingDashboardController)));

// ─── Rate cards ───────────────────────────────────────────────────────────────
router.get("/rate-cards", asyncHandler(billingRateCardController.list.bind(billingRateCardController)));
router.post("/rate-cards", asyncHandler(billingRateCardController.create.bind(billingRateCardController)));

// ─── Usage events ─────────────────────────────────────────────────────────────
router.post("/usage-events/ingest", asyncHandler(billingUsageEventController.ingest.bind(billingUsageEventController)));
router.get("/usage-events", asyncHandler(billingUsageEventController.list.bind(billingUsageEventController)));
router.post("/usage-events", asyncHandler(billingUsageEventController.create.bind(billingUsageEventController)));

// ─── Accruals ─────────────────────────────────────────────────────────────────
router.get("/accruals", asyncHandler(billingContractController.listAccruals.bind(billingContractController)));

// ─── Invoices ─────────────────────────────────────────────────────────────────
router.post("/invoices/generate-advanced", asyncHandler(billingInvoiceController.generateAdvanced.bind(billingInvoiceController)));
router.post("/invoices/generate", asyncHandler(billingInvoiceController.generate.bind(billingInvoiceController)));
router.get("/invoices", asyncHandler(billingInvoiceController.list.bind(billingInvoiceController)));
router.get("/v1/invoices", asyncHandler(billingInvoiceController.list.bind(billingInvoiceController)));
router.post("/invoices/:invoiceId/approvals/:approvalId", asyncHandler(billingInvoiceController.resolveApproval.bind(billingInvoiceController)));
router.get("/invoices/:invoiceId/export", asyncHandler(billingInvoiceController.exportInvoice.bind(billingInvoiceController)));
router.post("/invoices/:invoiceId/erp-post", asyncHandler(billingInvoiceController.queueErpPost.bind(billingInvoiceController)));

// ─── Contract overrides ───────────────────────────────────────────────────────
router.get("/contract-overrides", asyncHandler(billingContractController.listOverrides.bind(billingContractController)));
router.post("/contract-overrides", asyncHandler(billingContractController.createOverride.bind(billingContractController)));

// ─── Discount rules ───────────────────────────────────────────────────────────
router.get("/discount-rules", asyncHandler(billingContractController.listDiscounts.bind(billingContractController)));
router.post("/discount-rules", asyncHandler(billingContractController.createDiscount.bind(billingContractController)));

// ─── Revenue share rules ──────────────────────────────────────────────────────
router.get("/revenue-share-rules", asyncHandler(billingContractController.listRevenueShare.bind(billingContractController)));
router.post("/revenue-share-rules", asyncHandler(billingContractController.createRevenueShare.bind(billingContractController)));

// ─── Approval matrices ────────────────────────────────────────────────────────
router.get("/approval-matrices", asyncHandler(billingApprovalMatrixController.list.bind(billingApprovalMatrixController)));
router.post("/approval-matrices", asyncHandler(billingApprovalMatrixController.create.bind(billingApprovalMatrixController)));

// ─── ERP postings ─────────────────────────────────────────────────────────────
router.get("/erp-postings", asyncHandler(billingErpController.list.bind(billingErpController)));
router.post("/erp-postings/:attemptId/resolve", asyncHandler(billingErpController.resolve.bind(billingErpController)));

// ─── Disputes ─────────────────────────────────────────────────────────────────
router.get("/disputes", asyncHandler(billingDisputeController.list.bind(billingDisputeController)));
router.post("/disputes", asyncHandler(billingDisputeController.create.bind(billingDisputeController)));
router.post("/disputes/:disputeId/resolve", asyncHandler(billingDisputeController.resolve.bind(billingDisputeController)));

export default router;
