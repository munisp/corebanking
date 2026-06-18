import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "clickjack-defender",
  title: "Clickjack Defender",
  subtitle: "Anti-clickjacking frame policy",
  icon: Shield,
  accentColor: "red",
  apiBase: "/api/db/frame-policies",
  idField: "id",
  statusField: "status",
  searchFields: ["domain"],
  fields: [
    { key: "domain", label: "Domain", type: "text" },
    { key: "frameAncestors", label: "Frame Ancestors", type: "text" },
    { key: "xFrameOptions", label: "X-Frame-Options", type: "text" },
    { key: "violations24h", label: "Violations", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "domain", label: "Domain" },
    { key: "frameAncestors", label: "Frame Ancestors" },
    { key: "xFrameOptions", label: "X-Frame-Options" },
    { key: "violations24h", label: "Violations" },
    { key: "status", label: "Status" }
  ],
};

export default function ClickjackDefenderWorkspace() {
  return <CrudWorkspace config={config} />;
}
