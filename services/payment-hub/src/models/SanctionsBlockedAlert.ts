import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * W7-C-16: Durable, append-only record of every transfer blocked (or held) by
 * sanctions screening. The `sanctions.match-blocked` pub/sub event has no
 * consumer in the platform; this table is the system of record that guarantees
 * a blocked sanction can never vanish when the event bus drops the message.
 *
 * Deliberately no UpdateDateColumn/DeleteDateColumn: alert rows are written
 * once and never mutated or removed through the application.
 */
@Entity({ name: "sanctions_blocked_alerts" })
export class SanctionsBlockedAlert {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "text" })
  tenant_id!: string;

  /** Which party matched: "payer" | "beneficiary". */
  @Column({ type: "text" })
  party!: string;

  @Column({ type: "text" })
  screened_name!: string;

  @Column({ type: "text", nullable: true })
  customer_id: string | null = null;

  /** Screening result id returned by sanctions-screening-service. */
  @Column({ type: "text", nullable: true })
  screening_id: string | null = null;

  @Column({ type: "text", nullable: true })
  transfer_reference: string | null = null;

  /** Transfer amount in integer minor units (kobo). */
  @Column({ type: "bigint", nullable: true })
  amount_kobo: string | null = null;

  @Column({ type: "text" })
  risk_level!: string;

  /** Screening verdict: "block" | "hold_and_review". */
  @Column({ type: "text" })
  action!: string;

  @Column({ type: "text" })
  reason!: string;

  /** Whether the `sanctions.match-blocked` event reached the bus. */
  @Column({ type: "boolean", default: false })
  event_published!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;
}
