import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Brain } from "lucide-react";

const config: CrudConfig = {
  domainKey: "crop-yield-prediction",
  title: "Crop Yield Prediction",
  subtitle: "ML-based yield estimation from weather, soil and satellite data",
  icon: Brain,
  accentColor: "violet",
  apiBase: "/api/db/crop-yield-prediction",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "amount", label: "Yield", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Crop" },
    { key: "amount", label: "Predicted Yield" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function CropYieldPredictionWorkspace() {
  return <CrudWorkspace config={config} />;
}
