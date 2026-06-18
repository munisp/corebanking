import CrudWorkspace from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

export default function CashPoolingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "cash-pooling",
        title: "Cash Pooling",
        subtitle: "Zero-balance, target-balance, notional pooling, sweep automation (Go :8159)",
        icon: Layers,
        accentColor: "text-cyan-600",
        idField: "id",
        statusField: "status",
        searchFields: ["pool_name", "pool_type", "master_account"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Pool ID" },
          { key: "pool_name", label: "Pool Name", sortable: true },
          { key: "pool_type", label: "Type", sortable: true },
          { key: "master_account", label: "Master Account", sortable: true },
          { key: "currency", label: "Currency" },
          { key: "child_count", label: "Sub-Accounts", sortable: true },
          { key: "total_balance", label: "Total Balance", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
