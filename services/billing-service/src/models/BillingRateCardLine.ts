import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "rate_card_lines", schema: "billing" })
export class BillingRateCardLine {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ name: "rate_card_id", type: "varchar", length: 50 })
  rateCardId: string;

  @Column({ name: "meter_key", type: "varchar", length: 100 })
  meterKey: string;

  @Column({ name: "product_key", type: "varchar", length: 100 })
  productKey: string;

  @Column({ name: "charge_type", type: "varchar", length: 30, default: "per_unit" })
  chargeType: "flat" | "per_unit" | "tiered" | "minimum" | "percentage";

  @Column({ name: "unit_price", type: "numeric", precision: 20, scale: 8, default: 0 })
  unitPrice: number;

  @Column({ name: "included_units", type: "int", default: 0 })
  includedUnits: number;

  @Column({ name: "minimum_charge", type: "numeric", precision: 20, scale: 2, nullable: true })
  minimumCharge: number | null;

  @Column({ name: "maximum_charge", type: "numeric", precision: 20, scale: 2, nullable: true })
  maximumCharge: number | null;

  @Column({ name: "settlement_ledger_code", type: "varchar", length: 100, nullable: true })
  settlementLedgerCode: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
