import CrudWorkspace from "@/components/CrudWorkspace";
import { Landmark } from "lucide-react";

export default function WealthMgmtWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "wealth-mgmt",
        title: "Wealth Management",
        subtitle: "UHNW/HNW clients, investment mandates, relationship management (Python :8168)",
        icon: Landmark,
        accentColor: "text-amber-600",
        idField: "id",
        statusField: "status",
        searchFields: ["client_name", "client_type"],
        apiBase: "/api/db/customers",
        pageSize: 25,
        columns: [
          { key: "id", label: "Client ID" },
          { key: "client_name", label: "Client", sortable: true },
          { key: "client_type", label: "Type", sortable: true },
          { key: "total_wealth", label: "Wealth (USD)", sortable: true, render: (v) => `$${Number(v).toLocaleString()}` },
          { key: "risk_profile", label: "Risk", sortable: true },
          { key: "investment_mandate", label: "Mandate", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
