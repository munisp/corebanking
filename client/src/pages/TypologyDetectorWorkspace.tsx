import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Crosshair } from "lucide-react";

const config: CrudConfig = {
  domainKey: "typology-detector",
  title: "ML/TF Typology Detector",
  subtitle: "FATF + CBN typology matching — structuring, TBML, loan-back",
  icon: Crosshair,
  accentColor: "red",
  apiBase: "/api/db/typology-matches",
  idField: "id",
  statusField: "status",
  searchFields: ["typologyCode"],
  fields: [
    { key: "typologyCode", label: "Code", type: "text" },
    { key: "typologyName", label: "Typology", type: "text" },
    { key: "riskLevel", label: "Risk", type: "text" },
    { key: "customersTriggered", label: "Triggered", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "typologyCode", label: "Code" },
    { key: "typologyName", label: "Typology" },
    { key: "riskLevel", label: "Risk" },
    { key: "customersTriggered", label: "Triggered" },
    { key: "status", label: "Status" }
  ],
};

export default function TypologyDetectorWorkspace() {
  return <CrudWorkspace config={config} />;
}
