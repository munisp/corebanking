import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Brain } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-nlu-banking",
  title: "Voice NLU Banking Intent",
  subtitle: "Natural language understanding for banking voice commands",
  icon: Brain,
  accentColor: "indigo",
  apiBase: "/api/db/voice-nlu-banking",
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

export default function VoiceNluBankingWorkspace() {
  return <CrudWorkspace config={config} />;
}
