import CrudWorkspace from "@/components/CrudWorkspace";
import { Phone } from "lucide-react";

export default function MojaloopCallbacksWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "mojaloopcallbacks",
        title: "Mojaloop — FSPIOP Callbacks",
        subtitle: "Async FSPIOP callback handling — PUT /parties, PUT /quotes, PUT /transfers with correlation tracking",
        icon: Phone,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "resource", "sourceFsp", "destFsp"],
        apiBase: "/api/db/transfers",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "type", label: "Type", sortable: true },
          { key: "resource", label: "Resource", sortable: true },
          { key: "sourceFsp", label: "Source FSP" },
          { key: "destFsp", label: "Dest FSP" },
          { key: "status", label: "Status", sortable: true },
          { key: "latencyMs", label: "Latency ms", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
