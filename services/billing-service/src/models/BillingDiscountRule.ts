import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "discount_rules", schema: "billing" })
export class BillingDiscountRule {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50 })
  billingAccountId: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ name: "discount_type", type: "varchar", length: 30, default: "percentage" })
  discountType: "percentage" | "fixed" | "threshold_percentage";

  @Column({ name: "meter_key", type: "varchar", length: 100, nullable: true })
  meterKey: string | null;

  @Column({ name: "product_key", type: "varchar", length: 100, nullable: true })
  productKey: string | null;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  percentage: number | null;

  @Column({ name: "fixed_amount", type: "numeric", precision: 20, scale: 2, nullable: true })
  fixedAmount: number | null;

  @Column({ name: "threshold_amount", type: "numeric", precision: 20, scale: 2, nullable: true })
  thresholdAmount: number | null;

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
