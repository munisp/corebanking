import CrudWorkspace from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

export default function TBPGBalanceCacheConfigsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "tbpgbalancecacheconfigs",
        title: "Balance Cache Configs",
        subtitle: "Redis-backed balance cache — sub-ms reads with TigerBeetle as source of truth",
        icon: Zap,
        accentColor: "text-blue-700",
        idField: "id",
        statusField: "name",
        searchFields: ["id", "name", "redisKeyPattern"],
        apiBase: "/api/db/tb-batch-configs",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name", sortable: true },
          { key: "redisKeyPattern", label: "Key Pattern" },
          { key: "ttlSeconds", label: "TTL", sortable: true },
          { key: "hitRate", label: "Hit Rate", sortable: true },
          { key: "avgReadLatencyUs", label: "Read µs", sortable: true },
          { key: "currentSize", label: "Cached", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
