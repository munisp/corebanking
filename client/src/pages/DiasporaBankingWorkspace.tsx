import CrudWorkspace from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

export default function DiasporaBankingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "diaspora-banking",
        title: "Diaspora Banking",
        subtitle: "Remittance corridors, dual-currency wallets, property investment schemes, and diaspora accounts",
        icon: Globe,
        accentColor: "text-teal-600",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "country", "customerId"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "country", label: "Country", sortable: true },
          { key: "accountType", label: "Type" },
          { key: "ngnBalance", label: "NGN Balance", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "fxBalance", label: "FX Balance", sortable: true, render: (v, row) => `${row.fxCurrency} ${Number(v).toLocaleString()}` },
          { key: "remittancesThisYear", label: "Remittances", sortable: true },
          { key: "totalRemittedNGN", label: "Total Remitted", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "name", label: "Full Name", type: "text", required: true },
          { key: "country", label: "Country", type: "select", options: ["United Kingdom", "United States", "Canada", "Germany", "UAE", "South Africa"], required: true },
          { key: "accountType", label: "Account Type", type: "select", options: ["dual_currency", "remittance_only"], required: true },
          { key: "fxCurrency", label: "FX Currency", type: "select", options: ["GBP", "USD", "EUR", "CAD", "AED"], required: true },
        ],
      }}
    />
  );
}
