import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { KycIdentityProviders, VerificationWorkflowStatus } from "../utils/enums";
import { ClientEntity } from "./ClientEntity";

@Entity("kyc_verification_workflow")
@Unique(["client_id", "client_app_user_id"])
export class KycVerificationWorkflowEntity extends BaseEntity {
  @Column({ type: "enum", enum: KycIdentityProviders })
  identity_provider!: KycIdentityProviders;

  @ManyToOne(() => ClientEntity, (client) => client.kyc_verifications)
  @JoinColumn({ name: "client_id" })
  client!: ClientEntity;

  @Column()
  client_id!: string;

  /**
   * M-53: for KYC flows this stores an AES-256-GCM envelope ("enc:v1:...") of the
   * applicant's government identifier (NIN/UIN) — never plaintext. Use
   * utils/fieldEncryption.encryptField/decryptField. (KYB flows store the CAC
   * registration number, a public corporate identifier, as plaintext.)
   */
  @Column()
  client_app_user_id!: string;

  /**
   * M-53: keyed HMAC-SHA256 lookup hash of the plaintext identifier, enabling
   * equality queries over encrypted values without offline brute-force risk.
   * Nullable so existing rows (pre-encryption) do not break schema sync; new
   * KYC rows always set it.
   */
  @Column({ nullable: true, default: null })
  client_app_user_id_hash?: string | null;

  @Column({ type: "enum", enum: VerificationWorkflowStatus, default: VerificationWorkflowStatus.RUNNING })
  status!: VerificationWorkflowStatus;

  @Column({ type: "float", default: 0.0 })
  score: number = 0.0;

  @Column({ default: false })
  has_sent_webhook!: boolean;
}
