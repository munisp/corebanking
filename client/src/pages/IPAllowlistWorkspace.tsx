import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

const config: CrudConfig = {
  domainKey: "ip-allowlist",
  title: "IP Allowlist Engine",
  subtitle: "IP allowlist/blocklist management",
  icon: Globe,
  accentColor: "blue",
  apiBase: "/api/db/ip-rules",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "cidr", label: "CIDR", type: "text" },
    { key: "type", label: "Type", type: "text" },
    { key: "hits24h", label: "Hits 24h", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "cidr", label: "CIDR" },
    { key: "type", label: "Type" },
    { key: "hits24h", label: "Hits 24h" },
    { key: "status", label: "Status" }
  ],
};

export default function IPAllowlistWorkspace() {
  return <CrudWorkspace config={config} />;
}
