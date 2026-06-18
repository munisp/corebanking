import CrudWorkspace from "@/components/CrudWorkspace";
import { Link2 } from "lucide-react";

export default function MojaloopCallbackEndpointsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopcallbackendpoints",
        title: "Mojaloop — Callback Endpoints",
        subtitle: "Registered FSPIOP callback URLs per participant — parties, quotes, transfers, bulk",
        icon: Link2,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "fspId", "type"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "fspId", label: "FSP ID", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "url", label: "URL" },
          { key: "status", label: "Status", sortable: true },
          { key: "successRate", label: "Success %", sortable: true },
          { key: "avgLatencyMs", label: "Avg ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
