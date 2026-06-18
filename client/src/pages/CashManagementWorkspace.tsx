import CrudWorkspace from "@/components/CrudWorkspace";
import { Banknote } from "lucide-react";

export default function CashManagementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "cash-management",
        title: "Cash & Liquidity",
        subtitle: "Cash positions, liquidity forecasting, CRR monitoring, funding gap analysis",
        icon: Banknote,
        accentColor: "text-green-800",
        idField: "id",
        statusField: "category",
        searchFields: ["description", "category", "currency"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "category", label: "Category", sortable: true },
          { key: "description", label: "Description" },
          { key: "balance", label: "Balance", sortable: true, render: (v, row) => `${row.currency} ${Number(v).toLocaleString()}` },
          { key: "currency", label: "Currency", sortable: true },
          { key: "lastUpdated", label: "Last Updated" },
        ],
        fields: [],
      }}
    />
  );
}
