import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Mail } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sms-banking-gateway",
  title: "SMS Banking Gateway",
  subtitle: "Keyword-based SMS commands: BAL, TRF, STMT",
  icon: Mail,
  accentColor: "rose",
  apiBase: "/api/db/sms-banking-gateway",
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

export default function SmsBankingGatewayWorkspace() {
  return <CrudWorkspace config={config} />;
}
