import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Send } from "lucide-react";

const config: CrudConfig = {
  domainKey: "telegram-bot-gateway",
  title: "Telegram Bot Gateway",
  subtitle: "Telegram Bot API webhook receiver and command handler",
  icon: Send,
  accentColor: "sky",
  apiBase: "/api/db/telegram-bot-gateway",
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

export default function TelegramBotGatewayWorkspace() {
  return <CrudWorkspace config={config} />;
}
