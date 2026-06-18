import CrudWorkspace from "@/components/CrudWorkspace";
import { ArrowRightLeft } from "lucide-react";

export default function ProxyRoutesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "proxyroutes",
        title: "Proxy Routes",
        subtitle: "Express-to-upstream proxy configuration — timeouts, retries, circuit breaker thresholds",
        icon: ArrowRightLeft,
        accentColor: "text-emerald-700",
        idField: "expressPath",
        statusField: "method",
        searchFields: ["expressPath", "upstream"],
        apiBase: "/api/db/route-trie-stats",
        pageSize: 25,
        columns: [
          { key: "expressPath", label: "Express Path", sortable: true },
          { key: "upstream", label: "Upstream", sortable: true },
          { key: "upstreamPort", label: "Port" },
          { key: "method", label: "Method" },
          { key: "timeoutMs", label: "Timeout", sortable: true },
          { key: "retries", label: "Retries" },
          { key: "fallbackToSeedData", label: "Fallback" },
        ],
        fields: [],
      }}
    />
  );
}
