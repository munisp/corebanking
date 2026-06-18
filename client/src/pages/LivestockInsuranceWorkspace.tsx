import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "livestock-insurance",
  title: "Livestock Insurance",
  subtitle: "Mortality, theft and disease coverage with parametric triggers",
  icon: ShieldCheck,
  accentColor: "red",
  apiBase: "/api/db/livestock-insurance",
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
    { key: "category", label: "Coverage" },
    { key: "amount", label: "Sum Insured" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function LivestockInsuranceWorkspace() {
  return <CrudWorkspace config={config} />;
}
