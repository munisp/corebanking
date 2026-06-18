import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { UserCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "telegram-kyc-bot",
  title: "Telegram KYC Bot",
  subtitle: "In-chat KYC onboarding with BVN/NIN verification",
  icon: UserCheck,
  accentColor: "lime",
  apiBase: "/api/db/telegram-kyc-bot",
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

export default function TelegramKycBotWorkspace() {
  return <CrudWorkspace config={config} />;
}
