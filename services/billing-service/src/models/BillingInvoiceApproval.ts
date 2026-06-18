import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity({ name: "invoice_approvals", schema: "billing" })
export class BillingInvoiceApproval {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "invoice_id", type: "varchar", length: 50 })
  invoiceId: string;

  @Column({ name: "stage_key", type: "varchar", length: 100 })
  stageKey: string;

  @Column({ name: "actor_role", type: "varchar", length: 30, default: "operations" })
  actorRole: "operations" | "treasury" | "compliance" | "branch";

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: "pending" | "approved" | "rejected" | "skipped";

  @Column({ name: "acted_at", type: "timestamp", nullable: true })
  actedAt: Date | null;

  @Column({ type: "text", nullable: true })
  note: string | null;
}
