import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Award } from "lucide-react";

const config: CrudConfig = {
  domainKey: "quality-certification",
  title: "Quality Grading Certification",
  subtitle: "Grading protocols, lab results and NAFDAC SON certification",
  icon: Award,
  accentColor: "amber",
  apiBase: "/api/db/quality-certification",
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
    { key: "category", label: "Grade" },
    { key: "amount", label: "Score" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function QualityCertificationWorkspace() {
  return <CrudWorkspace config={config} />;
}
