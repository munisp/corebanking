import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "contract_overrides", schema: "billing" })
export class BillingContractOverride {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50 })
  billingAccountId: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ name: "override_type", type: "varchar", length: 30 })
  overrideType: "unit_price" | "included_units" | "minimum_commit" | "billing_model" | "billing_period";

  @Column({ name: "meter_key", type: "varchar", length: 100, nullable: true })
  meterKey: string | null;

  @Column({ name: "product_key", type: "varchar", length: 100, nullable: true })
  productKey: string | null;

  @Column({ name: "value_number", type: "numeric", precision: 20, scale: 4, nullable: true })
  valueNumber: number | null;

  @Column({ name: "value_text", type: "varchar", length: 200, nullable: true })
  valueText: string | null;

  @Column({ name: "effective_from", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  effectiveFrom: Date;

  @Column({ name: "effective_to", type: "timestamp", nullable: true })
  effectiveTo: Date | null;

  @Column({ type: "varchar", length: 20, default: "draft" })
  status: "draft" | "active" | "expired";

  @Column({ name: "created_by", type: "varchar", length: 100, default: "system" })
  createdBy: string;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
