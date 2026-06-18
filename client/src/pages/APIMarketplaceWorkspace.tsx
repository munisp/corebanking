import CrudWorkspace from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

export default function APIMarketplaceWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "api-marketplace",
        title: "API Marketplace",
        subtitle: "Developer portal, subscriptions, usage analytics, rate limiting (Go :8178)",
        icon: Globe,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "status",
        searchFields: ["api_name", "category"],
        apiBase: "/api/db/api-keys",
        pageSize: 25,
        columns: [
          { key: "id", label: "API ID" },
          { key: "api_name", label: "Name", sortable: true },
          { key: "version", label: "Version" },
          { key: "category", label: "Category", sortable: true },
          { key: "pricing_model", label: "Pricing", sortable: true },
          { key: "rate_limit", label: "Rate Limit", sortable: true },
          { key: "subscribers", label: "Subscribers", sortable: true },
          { key: "monthly_call_volume", label: "Calls/mo", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
