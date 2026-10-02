import { HttpMethod } from "@dapr/dapr";
import { readEnv } from "../config/readEnv.config";
import { daprClient } from "../lib/daprClient";
import { ICreateTenantPayload, ITenant } from "../types/tenant";

class TenantService {
  private APP_ID: string = readEnv("TENANT_SERVICE_APP_ID") as string;

  async getTenant(tenant_id: string) {
    const { tenant } = (await daprClient.invoke(this.APP_ID, `tenant/${tenant_id}`, HttpMethod.GET, {})) as {
      message: string;
      tenant: ITenant | null;
    };

    return tenant;
  }

  async createTenant(payload: ICreateTenantPayload) {
    const { tenant } = (await daprClient.invoke(
      this.APP_ID,
      "system/create-tenant",
      HttpMethod.POST,
      payload,
      {
        "x-tenant-id": payload.tenantId,
      }
    )) as { message: string; tenant: ITenant };

    return tenant;
  }

  async getKeycloakPublicKey(tenantId: string) {
    const { public_rsa_key } = (await daprClient.invoke(
      this.APP_ID,
      `tenant/keycloak-public-key/${tenantId}`,
      HttpMethod.GET,
      {}
    )) as { public_rsa_key: string };

    return public_rsa_key;
  }

  async getLedgerId(tenantId: string): Promise<string> {
    const tenant = await this.getTenant(tenantId);
    const accountsFeature = tenant?.features?.find((f) => f.flag === "accounts");
    return accountsFeature?.config?.ledger_id ?? "1";
  }

  // PL-02 / OB-08: suspend a tenant record in tenant-management
  // (POST /tenant/{tenant_id}/suspend). Awaited — no fire-and-forget.
  async suspendTenant(tenantId: string): Promise<void> {
    await daprClient.invoke(
      this.APP_ID,
      `tenant/${tenantId}/suspend`,
      HttpMethod.POST,
      {},
      { "x-tenant-id": tenantId }
    );
  }
}

export const tenantService = new TenantService();
