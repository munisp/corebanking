import CrudWorkspace from "@/components/CrudWorkspace";
import { AlertTriangle } from "lucide-react";

export default function FraudAlertsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fraud-alerts",
        title: "Fraud Alerts",
        subtitle: "Real-time alerts — flagged, blocked, under review transactions with risk scores",
        icon: AlertTriangle,
        accentColor: "text-orange-600",
        idField: "id",
        statusField: "action",
        searchFields: ["id", "customerId", "ruleName", "details"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Alert ID" },
          { key: "transactionId", label: "Transaction" },
          { key: "customerId", label: "Customer" },
          { key: "ruleName", label: "Triggered Rule", sortable: true },
          { key: "riskScore", label: "Risk Score", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
          { key: "action", label: "Action" },
          { key: "createdAt", label: "Created", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
