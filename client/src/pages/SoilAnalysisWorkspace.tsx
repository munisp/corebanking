import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Beaker } from "lucide-react";

const config: CrudConfig = {
  domainKey: "soil-analysis",
  title: "Soil Analysis",
  subtitle: "Soil type classification, pH levels and nutrient mapping",
  icon: Beaker,
  accentColor: "orange",
  apiBase: "/api/db/soil-analysis",
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
    { key: "category", label: "Soil Type" },
    { key: "amount", label: "pH Level" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function SoilAnalysisWorkspace() {
  return <CrudWorkspace config={config} />;
}
