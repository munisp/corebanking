import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "csp-nonce",
  title: "CSP Nonce Engine",
  subtitle: "Nonce-based Content Security Policy",
  icon: Shield,
  accentColor: "green",
  apiBase: "/api/db/csp-policies",
  idField: "id",
  statusField: "status",
  searchFields: ["domain"],
  fields: [
    { key: "domain", label: "Domain", type: "text" },
    { key: "violations24h", label: "Violations 24h", type: "number" },
    { key: "uniqueSources", label: "Sources", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "domain", label: "Domain" },
    { key: "violations24h", label: "Violations 24h" },
    { key: "uniqueSources", label: "Sources" },
    { key: "status", label: "Status" }
  ],
};

export default function CSPNonceEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
