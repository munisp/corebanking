import CrudWorkspace from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";

export default function AnalyticsWidgetsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "analytics-widgets",
        title: "Analytics Dashboard",
        subtitle: "Financial, operational, risk, and customer KPIs — real-time widgets",
        icon: BarChart3,
        accentColor: "text-purple-600",
        idField: "id",
        statusField: "category",
        searchFields: ["title", "category", "type"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Widget ID" },
          { key: "title", label: "Title", sortable: true },
          { key: "type", label: "Type" },
          { key: "category", label: "Category", sortable: true },
          { key: "value", label: "Value" },
          { key: "trend", label: "Trend %", render: (v) => v ? `${Number(v) > 0 ? "+" : ""}${v}%` : "—" },
          { key: "period", label: "Period" },
        ],
        fields: [],
      }}
    />
  );
}
