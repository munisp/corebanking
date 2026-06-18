import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "accounts", schema: "billing" })
export class BillingAccount {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ name: "account_name", type: "varchar", length: 200 })
  accountName: string;

  @Column({ name: "billing_model", type: "varchar", length: 30, default: "usage" })
  billingModel: "subscription" | "usage" | "hybrid" | "revenue_share";

  @Column({ type: "varchar", length: 3, default: "NGN" })
  currency: string;

  @Column({ type: "varchar", length: 20, default: "draft" })
  status: "draft" | "active" | "suspended" | "closed";

  @Column({ name: "contract_start_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  contractStartAt: Date;

  @Column({ name: "contract_end_at", type: "timestamp", nullable: true })
  contractEndAt: Date | null;

  @Column({ name: "default_rate_card_id", type: "varchar", length: 50, nullable: true })
  defaultRateCardId: string | null;

  @Column({ name: "minimum_commit_amount", type: "numeric", precision: 20, scale: 2, default: 0 })
  minimumCommitAmount: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
