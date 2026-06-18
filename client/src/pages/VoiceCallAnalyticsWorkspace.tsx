import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BarChart3 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-call-analytics",
  title: "Voice Call Analytics",
  subtitle: "Call duration, sentiment analysis and intent success metrics",
  icon: BarChart3,
  accentColor: "amber",
  apiBase: "/api/db/voice-call-analytics",
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

export default function VoiceCallAnalyticsWorkspace() {
  return <CrudWorkspace config={config} />;
}
