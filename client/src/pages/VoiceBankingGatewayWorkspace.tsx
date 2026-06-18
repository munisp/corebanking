import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Phone } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-banking-gateway",
  title: "Voice Banking Gateway",
  subtitle: "IVR call routing and session management for Nigerian voice banking",
  icon: Phone,
  accentColor: "violet",
  apiBase: "/api/db/voice-banking-gateway",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" }
  ],
};

export default function VoiceBankingGatewayWorkspace() {
  return <CrudWorkspace config={config} />;
}
