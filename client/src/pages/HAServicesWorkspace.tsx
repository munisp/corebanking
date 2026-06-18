import CrudWorkspace from "@/components/CrudWorkspace";
import { Server } from "lucide-react";

export default function HAServicesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "haservices",
        title: "HA Services",
        subtitle: "Multi-zone replicas, health checks, failover strategies, rolling updates, load balancing",
        icon: Server,
        accentColor: "text-blue-700",
        idField: "service",
        statusField: "status",
        searchFields: ["service", "failoverStrategy"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "service", label: "Service", sortable: true },
          { key: "replicas", label: "Replicas" },
          { key: "readyReplicas", label: "Ready" },
          { key: "status", label: "Status", sortable: true },
          { key: "failoverStrategy", label: "Failover", sortable: true },
          { key: "uptime", label: "Uptime", sortable: true },
          { key: "loadBalancer", label: "LB" },
        ],
        fields: [],
      }}
    />
  );
}
