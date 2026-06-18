import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Layers } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agri-reinsurance",
  title: "Agricultural Reinsurance",
  subtitle: "Cedant-reinsurer workflows, treaty management and portfolio cessions",
  icon: Layers,
  accentColor: "purple",
  apiBase: "/api/db/agri-reinsurance",
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
    { key: "category", label: "Treaty Type" },
    { key: "amount", label: "Amount (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgriReinsuranceWorkspace() {
  return <CrudWorkspace config={config} />;
}
