import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "parametric-insurance-iot",
  title: "Parametric Insurance IoT",
  subtitle: "Automatic weather station data feed to trigger to payout pipeline",
  icon: Zap,
  accentColor: "yellow",
  apiBase: "/api/db/parametric-insurance-iot",
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
    { key: "category", label: "Trigger Type" },
    { key: "amount", label: "Threshold" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function ParametricInsuranceIotWorkspace() {
  return <CrudWorkspace config={config} />;
}
