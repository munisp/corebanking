import CrudWorkspace from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";

export default function CustodyServiceWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "custody-service",
        title: "Custody Services",
        subtitle: "Safekeeping, settlement, corporate actions, CSCS/FMDQ (Go :8169)",
        icon: Lock,
        accentColor: "text-slate-600",
        idField: "id",
        statusField: "status",
        searchFields: ["account_name", "client_name"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Account ID" },
          { key: "account_name", label: "Account", sortable: true },
          { key: "client_name", label: "Client", sortable: true },
          { key: "account_type", label: "Type", sortable: true },
          { key: "total_aum", label: "AUM", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "securities_count", label: "Securities", sortable: true },
          { key: "csd_participant", label: "CSD", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
