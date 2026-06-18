import CrudWorkspace from "@/components/CrudWorkspace";
import { Brain } from "lucide-react";

export default function CustomerInsightsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "customer-insights",
        title: "Customer Insights / ML",
        subtitle: "Churn prediction, cross-sell scoring, anomaly detection, CLV (Python :8149)",
        icon: Brain,
        accentColor: "text-violet-600",
        idField: "id",
        statusField: "risk_level",
        searchFields: ["customer_name", "segment", "risk_level"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customer_name", label: "Customer", sortable: true },
          { key: "segment", label: "Segment", sortable: true },
          { key: "churn_probability", label: "Churn %", sortable: true, render: (v) => `${(Number(v)*100).toFixed(0)}%` },
          { key: "risk_level", label: "Risk", sortable: true },
          { key: "predicted_revenue_loss", label: "Revenue at Risk", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "model_version", label: "Model" },
          { key: "scored_at", label: "Scored At" },
        ],
        fields: [],
      }}
    />
  );
}
