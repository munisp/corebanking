import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { HeadphonesIcon } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-agent-escalation",
  title: "Voice Agent Escalation",
  subtitle: "IVR to human agent handoff with context transfer",
  icon: HeadphonesIcon,
  accentColor: "orange",
  apiBase: "/api/db/voice-agent-escalation",
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

export default function VoiceAgentEscalationWorkspace() {
  return <CrudWorkspace config={config} />;
}
