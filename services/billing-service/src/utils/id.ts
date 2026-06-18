import { v4 as uuidv4 } from "uuid";

export function generateId(prefix?: string): string {
  const raw = uuidv4().replace(/-/g, "").slice(0, 16);
  return prefix ? `${prefix}_${raw}` : raw;
}

export function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  return `INV-${year}-${month}-${seq}`;
}

export function generateErpReference(invoiceNumber: string): string {
  return `ERP-${invoiceNumber}-${Date.now().toString(36).toUpperCase()}`;
}
