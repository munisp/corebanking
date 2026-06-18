import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Hash } from "lucide-react";

const config: CrudConfig = {
  domainKey: "ussd-banking-gateway",
  title: "USSD Banking Gateway",
  subtitle: "USSD session manager for *737# style short codes",
  icon: Hash,
  accentColor: "amber",
  apiBase: "/api/db/ussd-banking-gateway",
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

export default function UssdBankingGatewayWorkspace() {
  return <CrudWorkspace config={config} />;
}
