import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "./BaseEntity";

/**
 * In-app notification inbox entry for an end customer.
 * Backs the customer-console endpoints mounted at /orchestrator/notifications*
 * (list / mark-read / mark-all-read / delete).
 */
@Entity("notifications")
export class NotificationEntity extends BaseEntity {
  @Index()
  @Column({ type: "varchar", length: 128 })
  tenant_id!: string;

  @Index()
  @Column({ type: "varchar", length: 128 })
  user_id!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "varchar", length: 32, default: "general" })
  type!: string; // 'transaction' | 'alert' | 'general'

  @Column({ type: "boolean", default: false })
  is_read!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  read_at?: Date | null;
}
