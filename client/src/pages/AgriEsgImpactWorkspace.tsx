import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Leaf } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agri-esg-impact",
  title: "Agriculture ESG Impact",
  subtitle: "Environmental and social impact tracking with SDG alignment",
  icon: Leaf,
  accentColor: "green",
  apiBase: "/api/db/agri-esg-impact",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Impact Type" },
    { key: "amount", label: "Score" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgriEsgImpactWorkspace() {
  return <CrudWorkspace config={config} />;
}
