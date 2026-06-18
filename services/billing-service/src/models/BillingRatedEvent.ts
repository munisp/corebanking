import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "rated_events", schema: "billing" })
export class BillingRatedEvent {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "usage_event_id", type: "varchar", length: 50 })
  usageEventId: string;

  @Column({ name: "rate_card_id", type: "varchar", length: 50 })
  rateCardId: string;

  @Column({ name: "rate_card_line_id", type: "varchar", length: 50 })
  rateCardLineId: string;

  @Column({ name: "billing_period_key", type: "varchar", length: 20 })
  billingPeriodKey: string;

  @Column({ name: "quantity_rated", type: "numeric", precision: 20, scale: 4, default: 0 })
  quantityRated: number;

  @Column({ name: "billable_units", type: "numeric", precision: 20, scale: 4, default: 0 })
  billableUnits: number;

  @Column({ name: "amount_accrued", type: "numeric", precision: 20, scale: 2, default: 0 })
  amountAccrued: number;

  @Column({ type: "varchar", length: 3, default: "NGN" })
  currency: string;

  @Column({ name: "rating_explanation", type: "jsonb", default: () => "'{}'::jsonb" })
  ratingExplanation: Record<string, unknown>;

  @CreateDateColumn({ name: "rated_at" })
  ratedAt: Date;
}
