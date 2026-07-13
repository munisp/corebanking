import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Mic } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-asr-nigerian",
  title: "Nigerian Voice ASR Engine",
  subtitle: "Speech recognition for Nigerian English, Pidgin, Hausa, Yoruba, Igbo",
  icon: Mic,
  accentColor: "blue",
  apiBase: "/voice-banking-gateway/v1/asr",
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

export default function VoiceAsrNigerianWorkspace() {
  return <CrudWorkspace config={config} />;
}
