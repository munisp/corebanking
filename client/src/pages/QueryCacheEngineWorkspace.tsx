import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "query-cache",
  title: "Query Result Cache",
  subtitle: "TTL-based query result caching",
  icon: Zap,
  accentColor: "yellow",
  apiBase: "/api/db/query-cache-entries",
  idField: "id",
  statusField: "status",
  searchFields: ["queryHash"],
  fields: [
    { key: "queryHash", label: "Query Hash", type: "text" },
    { key: "tableName", label: "Table", type: "text" },
    { key: "hitRate", label: "Hit Rate", type: "text" },
    { key: "cacheSizeKB", label: "Size KB", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "queryHash", label: "Query Hash" },
    { key: "tableName", label: "Table" },
    { key: "hitRate", label: "Hit Rate" },
    { key: "cacheSizeKB", label: "Size KB" },
    { key: "status", label: "Status" }
  ],
};

export default function QueryCacheEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
