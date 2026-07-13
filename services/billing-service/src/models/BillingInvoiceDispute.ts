import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "invoice_disputes", schema: "billing" })
export class BillingInvoiceDispute {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "invoice_id", type: "varchar", length: 50 })
  invoiceId: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ type: "varchar", length: 20, default: "open" })
  status: "open" | "under_review" | "resolved" | "rejected";

  @Column({ type: "varchar", length: 20, default: "medium" })
  severity: "low" | "medium" | "high";

  @Column({ name: "reason_code", type: "varchar", length: 50, default: "usage_dispute" })
  reasonCode: "usage_dispute" | "pricing_dispute" | "tax_dispute" | "contract_dispute" | "duplicate_invoice";

  @Column({ type: "varchar", length: 300 })
  title: string;

  @Column({ type: "text", default: "" })
  detail: string;

  @Column({ name: "opened_by", type: "varchar", length: 100, default: "system" })
  openedBy: string;

  @Column({ name: "assigned_role", type: "varchar", length: 30, default: "operations" })
  assignedRole: "operations" | "treasury" | "compliance" | "branch";

  @CreateDateColumn({ name: "opened_at" })
  openedAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ name: "resolution_note", type: "text", nullable: true })
  resolutionNote: string | null;
}
