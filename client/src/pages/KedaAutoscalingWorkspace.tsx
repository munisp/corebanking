import CrudWorkspace from "@/components/CrudWorkspace";
import { ArrowUpCircle } from "lucide-react";

export default function KedaAutoscalingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "kedaautoscaling",
        title: "KEDA Autoscaling",
        subtitle: "Kafka/Prometheus/Redis-driven autoscaling, per-tier policies, ScaledObjects dashboard",
        icon: ArrowUpCircle,
        accentColor: "text-blue-700",
        idField: "name",
        statusField: "status",
        searchFields: ["name", "service"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "service", label: "Service", sortable: true },
          { key: "minReplicas", label: "Min" },
          { key: "maxReplicas", label: "Max" },
          { key: "currentReplicas", label: "Current", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "scalingDirection", label: "Direction", sortable: true },
          { key: "cpu", label: "CPU" },
          { key: "memory", label: "Memory" },
        ],
        fields: [],
      }}
    />
  );
}
