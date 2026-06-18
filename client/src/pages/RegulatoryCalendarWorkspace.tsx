import CrudWorkspace from "@/components/CrudWorkspace";
import { Clock } from "lucide-react";

export default function RegulatoryCalendarWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "regulatory-calendar",
        title: "Regulatory Calendar",
        subtitle: "Filing deadlines — CBN, NDIC, FIRS, NFIU, SEC, NSE with automation status",
        icon: Clock,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "status",
        searchFields: ["regulator", "requirement", "responsible"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "regulator", label: "Regulator", sortable: true },
          { key: "requirement", label: "Requirement", sortable: true },
          { key: "frequency", label: "Frequency" },
          { key: "nextDue", label: "Next Due", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "responsible", label: "Team" },
          { key: "automationLevel", label: "Automation" },
        ],
        fields: [],
      }}
    />
  );
}
