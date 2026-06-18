import CrudWorkspace from "@/components/CrudWorkspace";
import { ShieldAlert } from "lucide-react";

export default function RansomwareProtectionWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "ransomware-protection",
        title: "Ransomware Protection",
        subtitle: "Threat indicators, file integrity monitoring, backup verification, quarantine",
        icon: ShieldAlert,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "severity",
        searchFields: ["pattern", "type"],
        apiBase: "/api/db/incidents",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "pattern", label: "Pattern", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
          { key: "action", label: "Action", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
