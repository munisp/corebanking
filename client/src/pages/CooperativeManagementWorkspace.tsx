import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cooperative-management",
  title: "Cooperative Management",
  subtitle: "Cooperative CRUD, membership, governance, bylaws and roles",
  icon: Users,
  accentColor: "green",
  apiBase: "/api/db/cooperative-management",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "coopType", label: "Type", type: "text" },
    { key: "state", label: "State", type: "text" },
    { key: "memberCount", label: "Members", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "coopType", label: "Type" },
    { key: "state", label: "State" },
    { key: "memberCount", label: "Members" },
    { key: "repaymentRate", label: "Repayment %" },
    { key: "status", label: "Status" }
  ],
};

export default function CooperativeManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
