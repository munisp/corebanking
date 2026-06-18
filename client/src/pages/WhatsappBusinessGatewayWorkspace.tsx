import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { MessageSquare } from "lucide-react";

const config: CrudConfig = {
  domainKey: "whatsapp-business-gateway",
  title: "WhatsApp Business Gateway",
  subtitle: "WhatsApp Business API with Cloud API webhooks",
  icon: MessageSquare,
  accentColor: "green",
  apiBase: "/api/db/whatsapp-business-gateway",
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

export default function WhatsappBusinessGatewayWorkspace() {
  return <CrudWorkspace config={config} />;
}
