import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Smartphone } from "lucide-react";

const config: CrudConfig = {
  domainKey: "telegram-mini-app",
  title: "Telegram Mini App",
  subtitle: "Rich UI banking via Telegram Mini App platform",
  icon: Smartphone,
  accentColor: "green",
  apiBase: "/api/db/telegram-mini-app",
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

export default function TelegramMiniAppWorkspace() {
  return <CrudWorkspace config={config} />;
}
