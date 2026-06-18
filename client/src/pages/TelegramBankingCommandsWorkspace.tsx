import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Terminal } from "lucide-react";

const config: CrudConfig = {
  domainKey: "telegram-banking-commands",
  title: "Telegram Banking Commands",
  subtitle: "Banking commands: /balance, /transfer, /history, /pay_bill",
  icon: Terminal,
  accentColor: "cyan",
  apiBase: "/api/db/telegram-banking-commands",
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

export default function TelegramBankingCommandsWorkspace() {
  return <CrudWorkspace config={config} />;
}
