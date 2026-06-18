import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { BadgeCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "acgsf-guarantee",
  title: "ACGSF Guarantee",
  subtitle: "ACGSF application, guarantee tracking and CBN reporting",
  icon: BadgeCheck,
  accentColor: "emerald",
  apiBase: "/api/db/acgsf-guarantee",
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
    { key: "category", label: "Guarantee Type" },
    { key: "amount", label: "Amount (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AcgsfGuaranteeWorkspace() {
  return <CrudWorkspace config={config} />;
}
