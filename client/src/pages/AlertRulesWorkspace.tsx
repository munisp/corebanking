import CrudWorkspace from "@/components/CrudWorkspace";
import { Bell } from "lucide-react";

export default function AlertRulesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "alertrules",
        title: "Alert Rules",
        subtitle: "PagerDuty/Slack alert rules — error rates, transfer failures, SLA breaches",
        icon: Bell,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "severity",
        searchFields: ["id", "name", "severity"],
        apiBase: "/api/db/prometheus-dashboards",
        pageSize: 25,
        columns: [
          { key: "name", label: "Alert", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
          { key: "forDuration", label: "Duration" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
