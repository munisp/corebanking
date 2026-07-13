import type { Tenant } from './tenantService';

/**
 * Recursively search an object for the first non-empty value of `key`.
 * Stops at depth 4 to avoid runaway traversal.
 */
function deepFind(obj: unknown, key: string, depth = 0): string | null {
  if (depth > 4 || obj === null || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  if (key in record && record[key] != null && record[key] !== '') {
    return String(record[key]);
  }
  for (const v of Object.values(record)) {
    if (v !== null && typeof v === 'object') {
      const found = deepFind(v, key, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract required request headers from tenant config.
 * Pure function — no side effects, no circular dependencies.
 */
export function getTenantHeaders(tenant: Tenant | null): Record<string, string> {
  if (!tenant) {
    if (import.meta.env.DEV) {
      console.warn('getTenantHeaders: tenant is null');
    }
    return {};
  }

  const headers: Record<string, string> = {};
  const featureFlags = Array.isArray(tenant.feature_flags) ? tenant.feature_flags : [];

  // ── x-tenant-id ──────────────────────────────────────────────────────────
  if (tenant.tenant_id) {
    headers['x-tenant-id'] = tenant.tenant_id;
  } else if ((tenant as any).id) {
    headers['x-tenant-id'] = String((tenant as any).id);
  }

  // ── Keycloak headers (from auth feature flag) ─────────────────────────────
  const authFeature = featureFlags.find((f) => f.name === 'auth');
  if (authFeature?.config) {
    const cfg = authFeature.config as Record<string, unknown>;

    if (cfg.realm)          headers['x-keycloak-realm']   = String(cfg.realm);
    if (cfg.public_rsa_key) headers['x-keycloak-pub-key'] = String(cfg.public_rsa_key);

    const keycloakId = cfg.id ?? cfg.keycloak_id ?? cfg.client_id ?? null;
    if (keycloakId) headers['x-keycloak-id'] = String(keycloakId);
    if (keycloakId) headers['x-keycloak-id']     = String(keycloakId);
    if (keycloakId) headers['x-user-id']         = String(keycloakId);
    if (keycloakId) headers['x-user-role']       = "super_admin"; // Assuming only admins can perform API actions; adjust as needed
  }

  // ── x-ledger-id ───────────────────────────────────────────────────────────
  // Strategy (in order of priority):
  //   1. accounts feature flag — common config paths
  //   2. Deep search across ALL feature flag configs
  //   3. VITE_LEDGER_ID env var
  //   4. Default "1" (matches backend orchestrator default)

  let ledgerId: string | null = null;

  const accountsFeature = featureFlags.find((f) => f.name === 'accounts');
  if (accountsFeature?.config) {
    const cfg = accountsFeature.config as Record<string, unknown>;
    const account = (cfg.account ?? {}) as Record<string, unknown>;

    ledgerId =
      (account.ledger_id != null ? String(account.ledger_id) : null) ??
      (cfg.ledger_id    != null ? String(cfg.ledger_id)    : null) ??
      deepFind(cfg, 'ledger_id');
  }

  // Deep-search all flags if still not found
  if (!ledgerId) {
    for (const flag of featureFlags) {
      if (flag.config) {
        const found = deepFind(flag.config, 'ledger_id');
        if (found) { ledgerId = found; break; }
      }
    }
  }

  // Env var fallback
  if (!ledgerId && import.meta.env.VITE_LEDGER_ID) {
    ledgerId = String(import.meta.env.VITE_LEDGER_ID);
  }

  // Final default — matches backend orchestrator default
  headers['x-ledger-id'] = ledgerId ?? '1';

  // ── x-mint-id / x-mint-account-id ────────────────────────────────────────
  // Strategy (same as ledger_id):
  //   1. accounts feature flag — common config paths
  //   2. Deep search across ALL feature flag configs for mint_id / mint_account_id / account.id
  //   3. VITE_MINT_ID env var
  //   4. Fall back to ledger_id (often the same value in single-ledger tenants)

  let mintId: string | null = null;

  if (accountsFeature?.config) {
    const cfg = accountsFeature.config as Record<string, unknown>;
    const account = (cfg.account ?? {}) as Record<string, unknown>;
    mintId =
      (account.id         != null ? String(account.id)         : null) ??
      (account.mint_id    != null ? String(account.mint_id)    : null) ??
      (cfg.mint_id        != null ? String(cfg.mint_id)        : null) ??
      deepFind(cfg, 'mint_id') ??
      deepFind(cfg, 'mint_account_id');
  }

  // Deep-search all flags if still not found
  if (!mintId) {
    for (const flag of featureFlags) {
      if (flag.config) {
        const found =
          deepFind(flag.config, 'mint_id') ??
          deepFind(flag.config, 'mint_account_id') ??
          deepFind(flag.config, 'mint_account');
        if (found) { mintId = found; break; }
      }
    }
  }

  // Env var fallback
  if (!mintId && import.meta.env.VITE_MINT_ID) {
    mintId = String(import.meta.env.VITE_MINT_ID);
  }

  // Last resort: use ledger_id (often the same value for single-ledger tenants)
  if (!mintId) {
    mintId = headers['x-ledger-id'] ?? null;
  }

  if (mintId) {
    headers['x-mint-id']         = mintId;
    headers['x-mint-account-id'] = mintId;
  }

  // ── x-staff-id ───────────────────────────────────────────────────────────
  headers['x-staff-id'] = 'staff';

  if (import.meta.env.DEV) {
    console.log('getTenantHeaders result:', headers);
  }

  return headers;
}
