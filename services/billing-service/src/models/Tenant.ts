import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "tenants", schema: "billing" })
export class Tenant {
  @PrimaryColumn({ name: "tenant_id", type: "varchar", length: 100 })
  tenantId: string;

  @Column({ name: "tenant_name", type: "varchar", length: 255, nullable: true })
  tenantName: string | null;

  @Column({ type: "varchar", length: 20, default: "active" })
  status: "active" | "suspended" | "deleted";

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
