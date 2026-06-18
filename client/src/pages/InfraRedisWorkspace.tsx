import { Zap } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "infra-redis",
  title: "Redis Cache",
  subtitle: "Production caching — session store, rate limiting, cache invalidation, pub/sub channels",
  icon: Zap,
  accentColor: "red",
  fields: [
    { key: "key", label: "Cache Key", type: "readonly" },
    { key: "namespace", label: "Namespace", type: "readonly" },
    { key: "ttl_remaining", label: "TTL (s)", type: "readonly" },
    { key: "hits", label: "Hits", type: "readonly" },
    { key: "size_bytes", label: "Size (B)", type: "readonly" },
  ],
  columns: [
    { key: "key", label: "Key" },
    { key: "namespace", label: "Namespace" },
    { key: "ttl_remaining", label: "TTL" },
    { key: "hits", label: "Hits" },
    { key: "size_bytes", label: "Size" },
  ],
  idField: "key",
  searchFields: ["key", "namespace"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function InfraRedisWorkspace() {
  return <CrudWorkspace config={config} />;
}
