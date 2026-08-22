import { randomInt } from "crypto";
import { v4 as uuidv4 } from "uuid";

export function generateId(prefix?: string): string {
  const raw = uuidv4().replace(/-/g, "").slice(0, 16);
  return prefix ? `${prefix}_${raw}` : raw;
}

export function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export type PeriodType = "monthly" | "quarterly" | "semi_annual" | "annual" | "custom";

export function resolvePeriodBounds(periodType: PeriodType): { start: Date; end: Date; periodKey: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (periodType === "quarterly") {
    const q = Math.floor(month / 3);
    return { start: new Date(year, q * 3, 1), end: new Date(year, q * 3 + 3, 0, 23, 59, 59), periodKey: `${year}-Q${q + 1}` };
  }
  if (periodType === "annual") {
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59), periodKey: `${year}` };
  }

  const periodKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59), periodKey };
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  // CSPRNG sequence — never Math.random() for financial document numbers.
  const seq = String(randomInt(0, 100000)).padStart(5, "0");
  return `INV-${year}-${month}-${seq}`;
}

export function generateErpReference(invoiceNumber: string): string {
  return `ERP-${invoiceNumber}-${Date.now().toString(36).toUpperCase()}`;
}
