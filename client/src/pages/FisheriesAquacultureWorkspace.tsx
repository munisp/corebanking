import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Fish } from "lucide-react";

const config: CrudConfig = {
  domainKey: "fisheries-aquaculture",
  title: "Fisheries and Aquaculture Banking",
  subtitle: "Pond management, fingerling tracking and harvest scheduling",
  icon: Fish,
  accentColor: "blue",
  apiBase: "/api/db/fisheries-aquaculture",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Type" },
    { key: "amount", label: "Amount (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function FisheriesAquacultureWorkspace() {
  return <CrudWorkspace config={config} />;
}
