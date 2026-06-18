import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { GitBranch } from "lucide-react";

const config: CrudConfig = {
  domainKey: "whatsapp-banking-flows",
  title: "WhatsApp Banking Flows",
  subtitle: "Conversational banking flows for balance, transfer, bills",
  icon: GitBranch,
  accentColor: "emerald",
  apiBase: "/api/db/whatsapp-banking-flows",
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

export default function WhatsappBankingFlowsWorkspace() {
  return <CrudWorkspace config={config} />;
}
