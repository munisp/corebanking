import CrudWorkspace from "@/components/CrudWorkspace";
import { Server } from "lucide-react";

export default function ApisixUpstreamsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "apisixupstreams",
        title: "APISIX Upstreams",
        subtitle: "Upstream service management — load balancing, health checks, retry policies, timeouts",
        icon: Server,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "name", "service"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "service", label: "Service" },
          { key: "type", label: "LB Type", sortable: true },
          { key: "retries", label: "Retries" },
          { key: "connectTimeout", label: "Timeout", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
