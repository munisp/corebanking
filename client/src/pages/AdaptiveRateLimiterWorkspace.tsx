import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Activity } from "lucide-react";
const config: CrudConfig = {
  domainKey: "adaptive-rate-limiter", title: "Adaptive Rate Limiter",
  subtitle: "Token bucket and sliding window rate limiting. Per-IP, per-API-key, per-tenant. DDoS mitigation with adaptive thresholds.",
  icon: Activity, accentColor: "rose",
  fields: [
    { key: "name", label: "Policy Name", type: "text", required: true },
    { key: "endpointPattern", label: "Endpoint Pattern", type: "text", required: true },
    { key: "maxRequests", label: "Max Requests", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "name", label: "Policy", sortable: true },
    { key: "endpointPattern", label: "Endpoint" },
    { key: "windowSeconds", label: "Window" },
    { key: "maxRequests", label: "Max Req" },
    { key: "burstLimit", label: "Burst" },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/body-limits",
};
export default function AdaptiveRateLimiterWorkspace() { return <CrudWorkspace config={config} />; }
