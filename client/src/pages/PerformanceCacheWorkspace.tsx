import CrudWorkspace from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

export default function PerformanceCacheWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "performancecache",
        title: "Performance & Cache",
        subtitle: "Redis response cache, brotli/gzip compression, CDN edge optimization, bandwidth adaptation",
        icon: Zap,
        accentColor: "text-blue-700",
        idField: "key",
        statusField: "encoding",
        searchFields: ["key", "endpoint"],
        apiBase: "/api/db/redis-cache-entries",
        pageSize: 25,
        columns: [
          { key: "key", label: "Key", sortable: true },
          { key: "endpoint", label: "Endpoint", sortable: true },
          { key: "ttlSeconds", label: "TTL" },
          { key: "size", label: "Size" },
          { key: "hitCount", label: "Hits", sortable: true },
          { key: "hitRate", label: "Hit Rate", sortable: true },
          { key: "compressionRatio", label: "Ratio" },
          { key: "encoding", label: "Encoding" },
        ],
        fields: [],
      }}
    />
  );
}
