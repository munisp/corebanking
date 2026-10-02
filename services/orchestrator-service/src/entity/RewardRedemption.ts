import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "./BaseEntity";

/**
 * A points redemption against the reward catalog.
 * Backs POST /orchestrator/rewards/redeem and GET /orchestrator/rewards/redemption-history.
 */
@Entity("reward_redemptions")
export class RewardRedemptionEntity extends BaseEntity {
  @Index()
  @Column({ type: "varchar", length: 128 })
  tenant_id!: string;

  @Index()
  @Column({ type: "varchar", length: 128 })
  user_id!: string;

  @Column({ type: "varchar", length: 64 })
  option_id!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "int", default: 0 })
  points_spent!: number;

  @Column({ type: "varchar", length: 32, default: "completed" })
  status!: string; // 'pending' | 'completed' | 'failed'

  @Column({ type: "varchar", length: 64, nullable: true })
  tracking_number?: string | null;
}
