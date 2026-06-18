import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { GraduationCap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "aml-training-tracker",
  title: "AML Training Tracker",
  subtitle: "Staff AML/CFT training compliance and certification",
  icon: GraduationCap,
  accentColor: "green",
  apiBase: "/api/db/aml-training-records",
  idField: "id",
  statusField: "status",
  searchFields: ["staffName"],
  fields: [
    { key: "staffName", label: "Staff", type: "text" },
    { key: "role", label: "Role", type: "text" },
    { key: "trainingModule", label: "Module", type: "text" },
    { key: "score", label: "Score", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "staffName", label: "Staff" },
    { key: "role", label: "Role" },
    { key: "trainingModule", label: "Module" },
    { key: "score", label: "Score" },
    { key: "status", label: "Status" }
  ],
};

export default function AMLTrainingTrackerWorkspace() {
  return <CrudWorkspace config={config} />;
}
