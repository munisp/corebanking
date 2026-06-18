import CrudWorkspace from "@/components/CrudWorkspace";
import { AlertTriangle } from "lucide-react";

export default function OpenappsecEventsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "openappsecevents",
        title: "WAF Events",
        subtitle: "Security events — blocked attacks with source IP, payload, ML score, geo-location",
        icon: AlertTriangle,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "severity",
        searchFields: ["id", "ruleName", "sourceIP", "uri"],
        apiBase: "/api/db/security-events",
        pageSize: 25,
        columns: [
          { key: "ruleName", label: "Rule", sortable: true },
          { key: "sourceIP", label: "Source IP" },
          { key: "uri", label: "URI" },
          { key: "action", label: "Action", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
          { key: "mlScore", label: "ML Score", sortable: true },
          { key: "geoCountry", label: "Country", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
