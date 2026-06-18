import { ApplicationFailure } from "@temporalio/activity";
import { billingService } from "../../services/billingService";

export async function checkTenantBillingStatus(tenant_id: string): Promise<void> {
  try {
    const billing = await billingService.getBillingInfo(tenant_id);
    if (billing.status === "suspended") {
      throw ApplicationFailure.nonRetryable("Tenant billing suspended");
    }
  } catch (err: any) {
    // Only block on an explicit suspension — infrastructure failures are fail-open
    if (err instanceof ApplicationFailure) throw err;
    console.warn(`[checkTenantBillingStatus] billing service unreachable for ${tenant_id}, proceeding:`, err.message);
  }
}
