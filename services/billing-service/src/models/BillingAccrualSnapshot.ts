import { Entity, Column, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "accrual_snapshots", schema: "billing" })
export class BillingAccrualSnapshot {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50 })
  billingAccountId: string;

  @Column({ name: "billing_period_key", type: "varchar", length: 20 })
  billingPeriodKey: string;

  @Column({ name: "meter_key", type: "varchar", length: 100 })
  meterKey: string;

  @Column({ name: "product_key", type: "varchar", length: 100 })
  productKey: string;

  @Column({ name: "rated_event_count", type: "int", default: 0 })
  ratedEventCount: number;

  @Column({ name: "usage_quantity", type: "numeric", precision: 20, scale: 4, default: 0 })
  usageQuantity: number;

  @Column({ name: "accrued_amount", type: "numeric", precision: 20, scale: 2, default: 0 })
  accruedAmount: number;

  @Column({ name: "unrated_event_count", type: "int", default: 0 })
  unratedEventCount: number;

  @Column({ name: "last_usage_at", type: "timestamp", nullable: true })
  lastUsageAt: Date | null;

  @Column({ name: "last_rated_at", type: "timestamp", nullable: true })
  lastRatedAt: Date | null;

  @Column({ name: "snapshot_status", type: "varchar", length: 20, default: "healthy" })
  snapshotStatus: "healthy" | "lagging" | "review";

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
