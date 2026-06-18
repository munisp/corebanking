import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { MapPin } from "lucide-react";
const config: CrudConfig = {
  domainKey: "agent-kyc-capture", title: "Agent-Assisted KYC Capture",
  subtitle: "Offline-capable field capture, agent quality scoring, geo-fencing, sync queue management, LGA-level coverage tracking.",
  icon: MapPin, accentColor: "amber",
  fields: [
    { key: "agentId", label: "Agent ID", type: "text", required: true },
    { key: "customerName", label: "Customer Name", type: "text", required: true },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "agentName", label: "Agent", sortable: true },
    { key: "customerName", label: "Customer" }, { key: "lga", label: "LGA" },
    { key: "offlineCapture", label: "Offline" }, { key: "qualityScore", label: "Quality Score", sortable: true },
  ],
  idField: "id", searchFields: ["agentName", "customerName", "lga"],
  apiBase: "/api/db/accounts",
};
export default function AgentKYCCaptureWorkspace() { return <CrudWorkspace config={config} />; }
