import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { GitBranch } from "lucide-react";

const config: CrudConfig = {
  domainKey: "route-trie",
  title: "Route Trie Optimizer",
  subtitle: "Radix-tree O(log N) route matching",
  icon: GitBranch,
  accentColor: "blue",
  apiBase: "/api/db/route-trie-stats",
  idField: "id",
  statusField: "status",
  searchFields: ["routePrefix"],
  fields: [
    { key: "routePrefix", label: "Prefix", type: "text" },
    { key: "totalRoutes", label: "Routes", type: "number" },
    { key: "avgLookupNs", label: "Lookup (ns)", type: "number" },
    { key: "cacheHitRate", label: "Cache Hit", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "routePrefix", label: "Prefix" },
    { key: "totalRoutes", label: "Routes" },
    { key: "avgLookupNs", label: "Lookup (ns)" },
    { key: "cacheHitRate", label: "Cache Hit" },
    { key: "status", label: "Status" }
  ],
};

export default function RouteTrieOptimizerWorkspace() {
  return <CrudWorkspace config={config} />;
}
