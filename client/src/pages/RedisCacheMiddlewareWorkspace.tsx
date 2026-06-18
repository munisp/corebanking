import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

const config: CrudConfig = {
  domainKey: "redis-cache",
  title: "Redis Response Cache",
  subtitle: "Redis-backed response cache with per-route TTL",
  icon: Database,
  accentColor: "red",
  apiBase: "/api/db/redis-cache-entries",
  idField: "id",
  statusField: "status",
  searchFields: ["route"],
  fields: [
    { key: "route", label: "Route", type: "text" },
    { key: "ttlSeconds", label: "TTL (s)", type: "number" },
    { key: "hitRate", label: "Hit Rate", type: "text" },
    { key: "avgLatencyMs", label: "Latency (ms)", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "route", label: "Route" },
    { key: "ttlSeconds", label: "TTL (s)" },
    { key: "hitRate", label: "Hit Rate" },
    { key: "avgLatencyMs", label: "Latency (ms)" },
    { key: "status", label: "Status" }
  ],
};

export default function RedisCacheMiddlewareWorkspace() {
  return <CrudWorkspace config={config} />;
}
