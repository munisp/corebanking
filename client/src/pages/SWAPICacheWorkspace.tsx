import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Download } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sw-api-cache",
  title: "Service Worker API Cache",
  subtitle: "Stale-while-revalidate API caching in SW",
  icon: Download,
  accentColor: "blue",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["pattern"],
  fields: [
    { key: "pattern", label: "Pattern", type: "text" },
    { key: "strategy", label: "Strategy", type: "text" },
    { key: "maxAge", label: "Max Age (s)", type: "number" },
    { key: "cacheHitRate", label: "Hit Rate", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "pattern", label: "Pattern" },
    { key: "strategy", label: "Strategy" },
    { key: "maxAge", label: "Max Age (s)" },
    { key: "cacheHitRate", label: "Hit Rate" },
    { key: "status", label: "Status" }
  ],
};

export default function SWAPICacheWorkspace() {
  return <CrudWorkspace config={config} />;
}
