import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Read the current tenant's ID from localStorage.
 * Checks tenant_config (canonical source, populated after login) then falls
 * back to the bare tenant_id key so all API ?tenant_id= query params are
 * consistently populated.
 */
export function getTenantId(): string {
  try {
    const raw = localStorage.getItem("tenant_config");
    if (raw) {
      const parsed = JSON.parse(raw);
      const cfg = parsed.tenant || parsed;
      const id = cfg.tenant_id || cfg.id;
      if (id) return String(id);
    }
  } catch { /* ignore parse errors */ }
  return localStorage.getItem("tenant_id") || "";
}
