import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "hot-data-cache",
  title: "Hot Data Cache",
  subtitle: "LRU/LFU/ARC per-service in-memory cache",
  icon: Zap,
  accentColor: "orange",
  apiBase: "/api/db/hot-data-caches",
  idField: "id",
  statusField: "status",
  searchFields: ["service"],
  fields: [
    { key: "service", label: "Service", type: "text" },
    { key: "cacheType", label: "Type", type: "text" },
    { key: "hitRate", label: "Hit Rate", type: "text" },
    { key: "memoryMB", label: "Memory MB", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "service", label: "Service" },
    { key: "cacheType", label: "Type" },
    { key: "hitRate", label: "Hit Rate" },
    { key: "memoryMB", label: "Memory MB" },
    { key: "status", label: "Status" }
  ],
};

export default function HotDataCacheWorkspace() {
  return <CrudWorkspace config={config} />;
}
