import CrudWorkspace from "@/components/CrudWorkspace";
import { PieChart } from "lucide-react";

export default function CustomerSegmentsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "customer-segments",
        title: "Customer Segments",
        subtitle: "Retail/SME/corporate/HNW classification — profitability, churn risk, cross-sell",
        icon: PieChart,
        accentColor: "text-pink-700",
        idField: "id",
        statusField: "churnRisk",
        searchFields: ["customerName", "segment", "relationshipManager"],
        apiBase: "/api/db/customers",
        pageSize: 25,
        columns: [
          { key: "customerId", label: "ID" },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "segment", label: "Segment", sortable: true },
          { key: "totalRelationshipValue", label: "TRV", sortable: true, render: (v) => { const n = Number(v); return n >= 1e9 ? `₦${(n / 1e9).toFixed(1)}B` : `₦${(n / 1e6).toFixed(0)}M`; } },
          { key: "productCount", label: "Products", sortable: true },
          { key: "monthlyTransactions", label: "Monthly Txns", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "profitabilityScore", label: "Profit Score", sortable: true },
          { key: "churnRisk", label: "Churn Risk", sortable: true },
          { key: "relationshipManager", label: "RM" },
          { key: "npsScore", label: "NPS" },
        ],
        fields: [],
      }}
    />
  );
}
