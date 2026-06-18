import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Search } from "lucide-react";

const config: CrudConfig = {
  domainKey: "opensearch-optimizer",
  title: "OpenSearch Optimizer",
  subtitle: "Index analyzers and result caching",
  icon: Search,
  accentColor: "blue",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["indexName"],
  fields: [
    { key: "indexName", label: "Index", type: "text" },
    { key: "shards", label: "Shards", type: "number" },
    { key: "avgQueryMs", label: "Avg Query (ms)", type: "number" },
    { key: "resultCacheEnabled", label: "Cache", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "indexName", label: "Index" },
    { key: "shards", label: "Shards" },
    { key: "avgQueryMs", label: "Avg Query (ms)" },
    { key: "resultCacheEnabled", label: "Cache" },
    { key: "status", label: "Status" }
  ],
};

export default function OpenSearchOptimizerWorkspace() {
  return <CrudWorkspace config={config} />;
}
