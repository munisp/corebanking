import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { RefreshCw } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cache-invalidation",
  title: "Cache Invalidation Engine",
  subtitle: "Redis pub/sub cache invalidation with pattern matching",
  icon: RefreshCw,
  accentColor: "orange",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["channel"],
  fields: [
    { key: "channel", label: "Channel", type: "text" },
    { key: "subscribers", label: "Subscribers", type: "number" },
    { key: "invalidations24h", label: "Invalidations 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "channel", label: "Channel" },
    { key: "subscribers", label: "Subscribers" },
    { key: "invalidations24h", label: "Invalidations 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function CacheInvalidationWorkspace() {
  return <CrudWorkspace config={config} />;
}
