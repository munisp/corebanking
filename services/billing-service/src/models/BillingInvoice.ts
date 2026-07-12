import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "invoices", schema: "billing" })
export class BillingInvoice {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "invoice_number", type: "varchar", length: 50, unique: true })
  invoiceNumber: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50 })
  billingAccountId: string;

  @Column({ name: "billing_period_key", type: "varchar", length: 20 })
  billingPeriodKey: string;

  @Column({ name: "billing_period_type", type: "varchar", length: 20, default: "monthly" })
  billingPeriodType: "monthly" | "quarterly" | "semi_annual" | "annual" | "custom";

  @Column({ name: "period_start_at", type: "timestamp" })
  periodStartAt: Date;

  @Column({ name: "period_end_at", type: "timestamp" })
  periodEndAt: Date;

  @Column({ type: "varchar", length: 3, default: "NGN" })
  currency: string;

  @Column({ name: "subtotal_amount", type: "numeric", precision: 20, scale: 2, default: 0 })
  subtotalAmount: number;

  @Column({ name: "discount_amount", type: "numeric", precision: 20, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: "revenue_share_amount", type: "numeric", precision: 20, scale: 2, default: 0 })
  revenueShareAmount: number;

  @Column({ name: "minimum_commit_adjustment", type: "numeric", precision: 20, scale: 2, default: 0 })
  minimumCommitAdjustment: number;

  @Column({ name: "tax_amount", type: "numeric", precision: 20, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: "total_amount", type: "numeric", precision: 20, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: "varchar", length: 30, default: "draft" })
  status: "draft" | "pending_approval" | "approved" | "rejected" | "issued" | "paid" | "void";

  @Column({ name: "approval_status", type: "varchar", length: 20, default: "pending" })
  approvalStatus: "pending" | "approved" | "rejected" | "skipped";

  @CreateDateColumn({ name: "generated_at" })
  generatedAt: Date;

  @Column({ name: "due_at", type: "timestamp" })
  dueAt: Date;

  @Column({ name: "approval_step_count", type: "int", default: 0 })
  approvalStepCount: number;

  @Column({ name: "issued_at", type: "timestamp", nullable: true })
  issuedAt: Date | null;

  @Column({ name: "erp_reference", type: "varchar", length: 100, nullable: true })
  erpReference: string | null;
}
