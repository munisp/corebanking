import CrudWorkspace from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";

export default function CircuitBreakerDashboardWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "circuitbreakerdashboard",
        title: "Circuit Breaker Dashboard",
        subtitle: "Per-service circuit breakers, state machines, fallback strategies, health-aware routing (Rust :8260)",
        icon: ShieldCheck,
        accentColor: "text-blue-700",
        idField: "service",
        statusField: "state",
        searchFields: ["service", "fallbackStrategy"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "service", label: "Service", sortable: true },
          { key: "state", label: "State", sortable: true },
          { key: "failureCount", label: "Failures" },
          { key: "successCount", label: "Successes", sortable: true },
          { key: "failureThreshold", label: "Threshold" },
          { key: "fallbackStrategy", label: "Fallback", sortable: true },
          { key: "p50LatencyMs", label: "P50ms" },
          { key: "p99LatencyMs", label: "P99ms" },
        ],
        fields: [],
      }}
    />
  );
}
