import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Monitor } from "lucide-react";
const config: CrudConfig = {
  domainKey: "session-security", title: "Session Security",
  subtitle: "Session security: device fingerprinting, geo-fencing, concurrent session control, step-up auth, risk-based management.",
  icon: Monitor, accentColor: "cyan",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "channel", label: "Channel", type: "select", options: ["web", "mobile", "ussd", "pos"], required: true },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "customerId", label: "Customer", sortable: true },
    { key: "channel", label: "Channel", sortable: true },
    { key: "ipAddress", label: "IP Address" },
    { key: "geoLocation", label: "Location" },
    { key: "status", label: "Status", sortable: true },
    { key: "riskScore", label: "Risk" },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/session-records",
};
export default function SessionSecurityWorkspace() { return <CrudWorkspace config={config} />; }
