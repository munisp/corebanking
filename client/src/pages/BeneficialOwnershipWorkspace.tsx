import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

const config: CrudConfig = {
  domainKey: "beneficial-ownership",
  title: "Beneficial Ownership Registry",
  subtitle: "UBO chain analysis — CAC API + manual verification",
  icon: Users,
  accentColor: "blue",
  apiBase: "/api/db/beneficial-owners",
  idField: "id",
  statusField: "status",
  searchFields: ["entityName"],
  fields: [
    { key: "entityName", label: "Entity", type: "text" },
    { key: "entityType", label: "Type", type: "text" },
    { key: "rcNumber", label: "RC Number", type: "text" },
    { key: "totalLayers", label: "Layers", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "entityName", label: "Entity" },
    { key: "entityType", label: "Type" },
    { key: "rcNumber", label: "RC Number" },
    { key: "totalLayers", label: "Layers" },
    { key: "status", label: "Status" }
  ],
};

export default function BeneficialOwnershipWorkspace() {
  return <CrudWorkspace config={config} />;
}
