import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Umbrella } from "lucide-react";

const config: CrudConfig = {
  domainKey: "multi-peril-crop-insurance",
  title: "Multi Peril Crop Insurance",
  subtitle: "Comprehensive coverage for pest, disease, hail, fire, theft and flood",
  icon: Umbrella,
  accentColor: "cyan",
  apiBase: "/api/db/multi-peril-crop-insurance",
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
    { key: "category", label: "Peril Type" },
    { key: "amount", label: "Sum Insured" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function MultiPerilCropInsuranceWorkspace() {
  return <CrudWorkspace config={config} />;
}
