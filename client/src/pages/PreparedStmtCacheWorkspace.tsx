import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Database } from "lucide-react";

const config: CrudConfig = {
  domainKey: "prepared-stmt",
  title: "Prepared Statement Cache",
  subtitle: "Reusable execution plan caching",
  icon: Database,
  accentColor: "green",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["queryPattern"],
  fields: [
    { key: "queryPattern", label: "Pattern", type: "text" },
    { key: "executions24h", label: "Executions 24h", type: "number" },
    { key: "avgExecMs", label: "Avg (ms)", type: "number" },
    { key: "planCacheHits", label: "Cache Hits", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "queryPattern", label: "Pattern" },
    { key: "executions24h", label: "Executions 24h" },
    { key: "avgExecMs", label: "Avg (ms)" },
    { key: "planCacheHits", label: "Cache Hits" },
    { key: "status", label: "Status" }
  ],
};

export default function PreparedStmtCacheWorkspace() {
  return <CrudWorkspace config={config} />;
}
