import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "rate_cards", schema: "billing" })
export class BillingRateCard {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50, nullable: true })
  billingAccountId: string | null;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "int", default: 1 })
  version: number;

  @Column({ type: "varchar", length: 20, default: "draft" })
  status: "draft" | "approved" | "active" | "retired";

  @Column({ name: "effective_from", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  effectiveFrom: Date;

  @Column({ name: "effective_to", type: "timestamp", nullable: true })
  effectiveTo: Date | null;

  @Column({ name: "pricing_currency", type: "varchar", length: 3, default: "NGN" })
  pricingCurrency: string;

  @Column({ name: "created_by", type: "varchar", length: 100, default: "system" })
  createdBy: string;

  @Column({ name: "approval_state", type: "varchar", length: 20, default: "pending" })
  approvalState: "pending" | "approved" | "rejected";

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
