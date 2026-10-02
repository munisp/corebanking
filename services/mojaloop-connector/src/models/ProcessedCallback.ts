import { Column, Entity } from "typeorm";
import { BaseModel } from "./BaseModel";

/**
 * MN-14: durable dedup of inbound fulfil callbacks. Claimed with
 * INSERT ... ON CONFLICT DO NOTHING on (provider, external_id); a replay
 * returns 200 with the prior outcome instead of re-firing downstream events.
 */
@Entity("processed_callbacks")
export class ProcessedCallback extends BaseModel {
  @Column()
  provider!: string;

  @Column()
  external_id!: string;

  @Column({ type: "text", nullable: true })
  outcome?: string | null;
}
