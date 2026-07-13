import { useMemo } from "react";
import { EnterpriseERPDashboard } from "./EnterpriseERPDashboard";

/**
 * Wrapper component that extracts tenant ID and customer ID from localStorage and passes them to EnterpriseERPDashboard
 */
export default function ERPIntegrationPage() {
  const { tenantId, customerId } = useMemo(() => {
    let tenant = "default-tenant";
    let customer = "default-customer";

    try {
      // Get tenant ID from tenant_config
      const tenantConfig = localStorage.getItem("tenant_config");
      if (tenantConfig) {
        const config = JSON.parse(tenantConfig);
        tenant = config.id || config.tenant_id || tenant;
      }

      // Get customer ID from auth_user
      const authUser = localStorage.getItem("auth_user");
      if (authUser) {
        const user = JSON.parse(authUser);
        customer = user.customer_id || user.id || user.user_id || customer;
      }
    } catch (error) {
      console.error("Failed to parse config from localStorage:", error);
    }

    return { tenantId: tenant, customerId: customer };
  }, []);

  return (
    <EnterpriseERPDashboard tenantId={tenantId} customerId={customerId} />
  );
}
