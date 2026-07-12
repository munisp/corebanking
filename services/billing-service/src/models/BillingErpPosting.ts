import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "erp_postings", schema: "billing" })
export class BillingErpPosting {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "invoice_id", type: "varchar", length: 50 })
  invoiceId: string;

  @Column({ name: "invoice_number", type: "varchar", length: 50 })
  invoiceNumber: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ type: "varchar", length: 20, default: "queued" })
  status: "queued" | "posted" | "failed";

  @Column({ name: "erp_system", type: "varchar", length: 30, default: "erpnext" })
  erpSystem: "erpnext" | "lakehouse_finance";

  @Column({ type: "varchar", length: 100 })
  reference: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: "queued_at" })
  queuedAt: Date;

  @Column({ name: "posted_at", type: "timestamp", nullable: true })
  postedAt: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;
}
