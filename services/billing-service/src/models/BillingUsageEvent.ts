import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "usage_events", schema: "billing" })
export class BillingUsageEvent {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "idempotency_key", type: "varchar", length: 200 })
  idempotencyKey: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50, nullable: true })
  billingAccountId: string | null;

  @Column({ name: "source_service", type: "varchar", length: 100 })
  sourceService: string;

  @Column({ name: "source_event_type", type: "varchar", length: 100 })
  sourceEventType: string;

  @Column({ name: "meter_key", type: "varchar", length: 100 })
  meterKey: string;

  @Column({ name: "product_key", type: "varchar", length: 100 })
  productKey: string;

  @Column({ type: "int", default: 1 })
  quantity: number;

  @Column({ name: "unit_amount", type: "numeric", precision: 20, scale: 8, nullable: true })
  unitAmount: number | null;

  @Column({ type: "varchar", length: 3, default: "NGN" })
  currency: string;

  @Column({ name: "event_timestamp", type: "timestamp" })
  eventTimestamp: Date;

  @CreateDateColumn({ name: "ingested_at" })
  ingestedAt: Date;

  @Column({ name: "correlation_id", type: "varchar", length: 100, nullable: true })
  correlationId: string | null;

  @Column({ name: "actor_id", type: "varchar", length: 100, nullable: true })
  actorId: string | null;

  @Column({ name: "resource_id", type: "varchar", length: 100, nullable: true })
  resourceId: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status: "pending" | "rated" | "ignored" | "failed";
}
