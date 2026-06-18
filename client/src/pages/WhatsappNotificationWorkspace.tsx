import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BellRing } from "lucide-react";

const config: CrudConfig = {
  domainKey: "whatsapp-notification",
  title: "WhatsApp Notifications",
  subtitle: "Template-based WhatsApp notifications and alerts",
  icon: BellRing,
  accentColor: "cyan",
  apiBase: "/api/db/whatsapp-notification",
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

export default function WhatsappNotificationWorkspace() {
  return <CrudWorkspace config={config} />;
}
