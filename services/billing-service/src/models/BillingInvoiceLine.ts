import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "invoice_lines", schema: "billing" })
export class BillingInvoiceLine {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "invoice_id", type: "varchar", length: 50 })
  invoiceId: string;

  @Column({ name: "line_type", type: "varchar", length: 30, default: "usage" })
  lineType: "usage" | "discount" | "revenue_share" | "minimum_commit" | "tax";

  @Column({ name: "meter_key", type: "varchar", length: 100, nullable: true })
  meterKey: string | null;

  @Column({ name: "product_key", type: "varchar", length: 100, nullable: true })
  productKey: string | null;

  @Column({ type: "text", default: "" })
  description: string;

  @Column({ type: "numeric", precision: 20, scale: 4, default: 0 })
  quantity: number;

  @Column({ name: "unit_price", type: "numeric", precision: 20, scale: 8, default: 0 })
  unitPrice: number;

  @Column({ type: "numeric", precision: 20, scale: 2, default: 0 })
  amount: number;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;
}
