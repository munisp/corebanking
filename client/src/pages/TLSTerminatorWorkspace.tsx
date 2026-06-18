import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";

const config: CrudConfig = {
  domainKey: "tls-terminator",
  title: "TLS Terminator",
  subtitle: "TLS 1.3 termination with OCSP stapling",
  icon: Lock,
  accentColor: "green",
  apiBase: "/api/db/tls-configs",
  idField: "id",
  statusField: "status",
  searchFields: ["domain"],
  fields: [
    { key: "domain", label: "Domain", type: "text" },
    { key: "protocol", label: "Protocol", type: "text" },
    { key: "ocspStapling", label: "OCSP Stapling", type: "text" },
    { key: "hstsPreload", label: "HSTS Preload", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "domain", label: "Domain" },
    { key: "protocol", label: "Protocol" },
    { key: "ocspStapling", label: "OCSP Stapling" },
    { key: "hstsPreload", label: "HSTS Preload" },
    { key: "status", label: "Status" }
  ],
};

export default function TLSTerminatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
