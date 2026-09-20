import { Column, Entity, Index } from "typeorm";
import { BaseModel } from "./BaseModel";

/**
 * MN-13: persisted alert when inbound funds are blocked by sanctions
 * screening. The funds themselves are routed to the sanctions-suspense
 * TigerBeetle account; this row is the audit artifact for STR filing.
 */
@Entity("sanctions_blocked_alerts")
export class SanctionsBlockedAlert extends BaseModel {
  @Index()
  @Column()
  transfer_id!: string;

  @Column()
  beneficiary!: string;

  @Column()
  payer_fsp!: string;

  @Column()
  amount!: string;

  @Column()
  currency!: string;

  @Column()
  screening_id!: string;

  @Column()
  risk_level!: string;

  @Column()
  action!: string;

  @Column()
  suspense_account_id!: string;

  @Column({ default: "open" })
  status!: string;

  @Column({ default: false })
  str_filed!: boolean;

  @Column({ type: "text", nullable: true })
  note?: string | null;
}
