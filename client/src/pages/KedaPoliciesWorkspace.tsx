import CrudWorkspace from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

export default function KedaPoliciesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "kedapolicies",
        title: "KEDA Scaling Policies",
        subtitle: "Tier-based scaling policies — critical financial, security, standard, background, infrastructure",
        icon: Layers,
        accentColor: "text-blue-700",
        idField: "tier",
        statusField: "tier",
        searchFields: ["tier", "description"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "tier", label: "Tier", sortable: true },
          { key: "description", label: "Description" },
          { key: "minReplicas", label: "Min" },
          { key: "maxReplicas", label: "Max" },
          { key: "targetCPU", label: "CPU%" },
          { key: "kafkaLagThreshold", label: "Kafka Lag" },
          { key: "rpsThreshold", label: "RPS" },
        ],
        fields: [],
      }}
    />
  );
}
