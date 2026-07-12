import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

@Entity({ name: "plan_catalog", schema: "billing" })
@Index("uq_plan_catalog_plan_period", ["plan", "billingPeriod"], { unique: true })
export class BillingPlanCatalog {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ type: "varchar", length: 30 })
  plan: "standard" | "premium" | "enterprise";

  @Column({ name: "billing_period", type: "varchar", length: 20 })
  billingPeriod: "monthly" | "annual";

  @Column({ name: "base_price", type: "numeric", precision: 20, scale: 2 })
  basePrice: number;

  @Column({ type: "varchar", length: 3, default: "NGN" })
  currency: string;

  @Column({ name: "included_api_calls", type: "int" })
  includedApiCalls: number;

  @Column({ name: "overage_price_per_call", type: "numeric", precision: 20, scale: 8 })
  overagePricePerCall: number;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
