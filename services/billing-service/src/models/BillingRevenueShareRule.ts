import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "revenue_share_rules", schema: "billing" })
export class BillingRevenueShareRule {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50 })
  billingAccountId: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "varchar", length: 30, default: "platform" })
  target: "platform" | "partner_bank" | "aggregator" | "reseller";

  @Column({ type: "numeric", precision: 5, scale: 2, default: 0 })
  percentage: number;

  @Column({ name: "beneficiary_name", type: "varchar", length: 200 })
  beneficiaryName: string;

  @Column({ name: "settlement_ledger_code", type: "varchar", length: 100, nullable: true })
  settlementLedgerCode: string | null;

  @Column({ name: "effective_from", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  effectiveFrom: Date;

  @Column({ name: "effective_to", type: "timestamp", nullable: true })
  effectiveTo: Date | null;

  @Column({ type: "varchar", length: 20, default: "draft" })
  status: "draft" | "active" | "expired";

  @Column({ name: "created_by", type: "varchar", length: 100, default: "system" })
  createdBy: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
