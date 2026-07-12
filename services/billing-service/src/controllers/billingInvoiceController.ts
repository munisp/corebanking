import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingInvoiceRepository } from "../repositories/billingInvoiceRepository";
import { billingInvoiceLineRepository } from "../repositories/billingInvoiceLineRepository";
import { billingInvoiceApprovalRepository } from "../repositories/billingInvoiceApprovalRepository";
import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { billingErpPostingRepository } from "../repositories/billingErpPostingRepository";
import { billingInvoiceService } from "../services/billingInvoiceService";
import { generateId, generateErpReference } from "../utils/id";

export const billingInvoiceController = {
  async list(req: Request, res: Response) {
    const [items, lines, approvals] = await Promise.all([
      billingInvoiceRepository.findAll(),
      billingInvoiceLineRepository.findAll(),
      billingInvoiceApprovalRepository.findAll(),
    ]);
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, lines, approvals, total: items.length });
  },

  async generate(req: Request, res: Response) {
    const { billingAccountId, periodType } = req.body;
    const accounts = billingAccountId
      ? [await billingAccountRepository.findById(billingAccountId)].filter(Boolean)
      : await billingAccountRepository.findActive();

    const results = await Promise.all(
      accounts.map((acc) => billingInvoiceService.generateForAccount(acc!.id, periodType ?? "monthly", false)),
    );

    return res.status(httpStatus.OK).json({
      asOf: new Date().toISOString(),
      invoices: results.map((r) => r.invoice),
      invoiceLines: results.flatMap((r) => r.lines),
      invoiceApprovals: results.flatMap((r) => r.approvals),
      total: results.length,
    });
  },

  async generateAdvanced(req: Request, res: Response) {
    const { billingAccountId, periodType } = req.body;
    const accounts = billingAccountId
      ? [await billingAccountRepository.findById(billingAccountId)].filter(Boolean)
      : await billingAccountRepository.findActive();

    const results = await Promise.all(
      accounts.map((acc) => billingInvoiceService.generateForAccount(acc!.id, periodType ?? "monthly", true)),
    );

    return res.status(httpStatus.OK).json({
      asOf: new Date().toISOString(),
      invoices: results.map((r) => r.invoice),
      invoiceLines: results.flatMap((r) => r.lines),
      invoiceApprovals: results.flatMap((r) => r.approvals),
      total: results.length,
    });
  },

  async resolveApproval(req: Request, res: Response) {
    const { invoiceId, approvalId } = req.params;
    const { decision, note } = req.body;
    const invoice = await billingInvoiceService.resolveApproval(invoiceId, approvalId, decision, note);
    return res.status(httpStatus.OK).json(invoice);
  },

  async exportInvoice(req: Request, res: Response) {
    const { invoiceId } = req.params;
    const format = (req.query.format as "csv" | "json" | "html") ?? "json";
    const { content, contentType } = await billingInvoiceService.exportInvoice(invoiceId, format);
    res.setHeader("Content-Type", contentType);
    if (format !== "html") {
      res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoiceId}.${format}`);
    }
    return res.send(content);
  },

  async queueErpPost(req: Request, res: Response) {
    const { invoiceId } = req.params;
    const { erpSystem } = req.body;
    const invoice = await billingInvoiceRepository.findById(invoiceId);
    if (!invoice) return res.status(httpStatus.NOT_FOUND).json({ message: "Invoice not found" });

    const posting = await billingErpPostingRepository.save({
      id: generateId("ep"),
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      tenantId: invoice.tenantId,
      status: "queued",
      erpSystem: erpSystem ?? "erpnext",
      reference: generateErpReference(invoice.invoiceNumber),
      payload: { invoiceId, invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount, currency: invoice.currency },
      queuedAt: new Date(),
    });

    return res.status(httpStatus.CREATED).json(posting);
  },
};
