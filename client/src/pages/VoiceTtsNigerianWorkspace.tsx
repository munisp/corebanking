import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Volume2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-tts-nigerian",
  title: "Nigerian Voice TTS Engine",
  subtitle: "Nigerian male and female voice text-to-speech synthesis",
  icon: Volume2,
  accentColor: "purple",
  apiBase: "/api/db/voice-tts-nigerian",
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

export default function VoiceTtsNigerianWorkspace() {
  return <CrudWorkspace config={config} />;
}
