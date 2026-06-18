import CrudWorkspace from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

export default function ApisixRoutesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "apisixroutes",
        title: "APISIX Routes",
        subtitle: "API gateway route management — upstream mapping, plugin orchestration, health-aware routing",
        icon: Globe,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "uri", "upstream"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "uri", label: "URI" },
          { key: "upstream", label: "Upstream", sortable: true },
          { key: "requestsPerSec", label: "RPS", sortable: true },
          { key: "avgLatencyMs", label: "Latency ms", sortable: true },
          { key: "errorRate", label: "Error %", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
