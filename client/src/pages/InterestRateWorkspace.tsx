import CrudWorkspace from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

export default function InterestRateWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "interest-rates",
        title: "Interest Rate Engine",
        subtitle: "CBN MPR tracking, base rates, spread matrices, and product rate calculations",
        icon: TrendingUp,
        accentColor: "text-purple-600",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "source", "currency"],
        apiBase: "/api/db/fx-trades",
        pageSize: 25,
        columns: [
          { key: "name", label: "Rate Name", sortable: true },
          { key: "rate", label: "Rate (%)", sortable: true, render: (v) => `${Number(v).toFixed(2)}%` },
          { key: "source", label: "Source", sortable: true },
          { key: "currency", label: "Currency" },
          { key: "effectiveAt", label: "Effective Date", sortable: true },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "name", label: "Rate Name", type: "text", required: true },
          { key: "rate", label: "Rate (%)", type: "number", required: true, min: 0, max: 100 },
          { key: "source", label: "Source", type: "select", options: ["CBN", "FMDQ", "FRBNY", "Internal"], required: true },
          { key: "currency", label: "Currency", type: "select", options: ["NGN", "USD", "GBP", "EUR"], required: true },
          { key: "effectiveAt", label: "Effective Date", type: "date", required: true },
          { key: "status", label: "Status", type: "select", options: ["active", "inactive"], required: true },
        ],
      }}
    />
  );
}
