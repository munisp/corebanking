import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ListTree } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-ivr-menu",
  title: "IVR Menu Engine",
  subtitle: "Interactive voice response menu tree with DTMF navigation",
  icon: ListTree,
  accentColor: "teal",
  apiBase: "/api/db/voice-ivr-menu",
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

export default function VoiceIvrMenuWorkspace() {
  return <CrudWorkspace config={config} />;
}
