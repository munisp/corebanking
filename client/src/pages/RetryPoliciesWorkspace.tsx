import CrudWorkspace from "@/components/CrudWorkspace";
import { RotateCcw } from "lucide-react";

export default function RetryPoliciesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "retrypolicies",
        title: "Retry Policies",
        subtitle: "Exponential backoff with jitter, per-domain retry strategies, dead letter queue management",
        icon: RotateCcw,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "name",
        searchFields: ["name"],
        apiBase: "/api/db/workflow-cases",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "maxRetries", label: "Max Retries" },
          { key: "baseDelayMs", label: "Base Delay" },
          { key: "maxDelayMs", label: "Max Delay" },
          { key: "backoffMultiplier", label: "Multiplier" },
          { key: "jitter", label: "Jitter" },
        ],
        fields: [],
      }}
    />
  );
}
