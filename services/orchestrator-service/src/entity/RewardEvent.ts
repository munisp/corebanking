import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "./BaseEntity";

/**
 * An earned reward (points credit) for a customer.
 * Backs GET /orchestrator/rewards/earned and the summary aggregates.
 */
@Entity("reward_events")
export class RewardEventEntity extends BaseEntity {
  @Index()
  @Column({ type: "varchar", length: 128 })
  tenant_id!: string;

  @Index()
  @Column({ type: "varchar", length: 128 })
  user_id!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", default: "" })
  description!: string;

  @Column({ type: "int", default: 0 })
  points!: number;

  @Column({ type: "varchar", length: 32, default: "bonus" })
  category!: string; // 'cashback' | 'bonus' | 'milestone' | 'referral' | 'streak'

  @Column({ type: "varchar", length: 128, nullable: true })
  transaction_id?: string | null;
}
