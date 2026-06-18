import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

export interface ApprovalStage {
  stageKey: string;
  actorRole: "operations" | "treasury" | "compliance" | "branch";
  label: string;
  minimumAmount?: number;
  maximumAmount?: number;
  autoApprove?: boolean;
}

@Entity({ name: "approval_matrices", schema: "billing" })
export class BillingApprovalMatrix {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ name: "billing_account_id", type: "varchar", length: 50, nullable: true })
  billingAccountId: string | null;

  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "varchar", length: 20, default: "draft" })
  status: "draft" | "active" | "retired";

  @Column({ name: "created_by", type: "varchar", length: 100, default: "system" })
  createdBy: string;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  stages: ApprovalStage[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
