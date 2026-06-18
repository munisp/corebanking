import CrudWorkspace from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

export default function CorrespondentBankingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "correspondent-banking",
        title: "Correspondent Banking",
        subtitle: "Nostro/vostro accounts, SWIFT RMA relationships, payment corridors",
        icon: Globe,
        accentColor: "text-sky-700",
        idField: "id",
        statusField: "status",
        searchFields: ["bankName", "swiftBic", "country", "city"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "bankName", label: "Bank", sortable: true },
          { key: "swiftBic", label: "SWIFT BIC" },
          { key: "country", label: "Country", sortable: true },
          { key: "relationship", label: "Type", sortable: true },
          { key: "currency", label: "CCY" },
          { key: "balance", label: "Balance", sortable: true, render: (v, row) => `${row.currency} ${Number(v).toLocaleString()}` },
          { key: "rmaStatus", label: "RMA", sortable: true },
          { key: "rmaExpiry", label: "RMA Expiry" },
          { key: "annualVolume", label: "Annual Vol", sortable: true, render: (v) => `${(Number(v) / 1e9).toFixed(1)}B` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
