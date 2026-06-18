import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cdn-edge-cache",
  title: "CDN Edge Cache",
  subtitle: "Cloudflare/CloudFront edge caching (Lagos, Abuja, Kano)",
  icon: Globe,
  accentColor: "green",
  apiBase: "/api/db/accounts",
  idField: "id",
  statusField: "status",
  searchFields: ["provider"],
  fields: [
    { key: "provider", label: "Provider", type: "text" },
    { key: "origin", label: "Origin", type: "text" },
    { key: "ttlStatic", label: "Static TTL", type: "number" },
    { key: "bandwidthSaved24h", label: "Saved 24h", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "provider", label: "Provider" },
    { key: "origin", label: "Origin" },
    { key: "ttlStatic", label: "Static TTL" },
    { key: "bandwidthSaved24h", label: "Saved 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function CDNEdgeCacheWorkspace() {
  return <CrudWorkspace config={config} />;
}
