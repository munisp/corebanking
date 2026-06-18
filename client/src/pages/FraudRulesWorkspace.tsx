import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function FraudRulesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fraud-rules",
        title: "Fraud Detection Rules",
        subtitle: "Velocity checks, amount thresholds, geo-anomaly, device fingerprinting, pattern analysis",
        icon: Shield,
        accentColor: "text-red-600",
        idField: "id",
        statusField: "severity",
        searchFields: ["name", "category", "severity"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Rule ID" },
          { key: "name", label: "Rule Name", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
          { key: "action", label: "Action" },
          { key: "hitCount", label: "Hits", sortable: true },
          { key: "lastTriggered", label: "Last Triggered" },
          { key: "enabled", label: "Enabled", render: (v) => v ? "Yes" : "No" },
        ],
        fields: [
          { key: "name", label: "Rule Name", type: "text", required: true },
          { key: "category", label: "Category", type: "select", options: ["velocity", "amount", "geo", "behavior", "device", "pattern"], required: true },
          { key: "severity", label: "Severity", type: "select", options: ["low", "medium", "high", "critical"], required: true },
          { key: "action", label: "Action", type: "select", options: ["flag", "block", "otp", "review"], required: true },
        ],
      }}
    />
  );
}
