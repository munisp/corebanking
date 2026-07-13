import { useMemo } from "react";
import { ChartOfAccountsDashboard } from "./ChartOfAccountsDashboard";

/**
 * Wrapper component that extracts tenant ID from localStorage and passes it to ChartOfAccountsDashboard
 */
export default function ChartOfAccountsPage() {
  const tenantId = useMemo(() => {
    try {
      const tenantConfig = localStorage.getItem("tenant_config");
      if (tenantConfig) {
        const config = JSON.parse(tenantConfig);
        // Use tenant_id (string identifier) not id (numeric database ID)
        return config.tenant_id || "default-tenant";
      }
    } catch (error) {
      console.error("Failed to parse tenant config:", error);
    }
    return "default-tenant";
  }, []);

  return <ChartOfAccountsDashboard tenantId={tenantId} />;
}
