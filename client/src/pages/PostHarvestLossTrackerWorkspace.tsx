import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Trash2 } from "lucide-react";

const config: CrudConfig = {
  domainKey: "post-harvest-loss-tracker",
  title: "Post Harvest Loss Tracking",
  subtitle: "Storage, transport and processing loss measurement",
  icon: Trash2,
  accentColor: "rose",
  apiBase: "/api/db/post-harvest-loss-tracker",
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
    { key: "category", label: "Loss Type" },
    { key: "amount", label: "Loss (tonnes)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function PostHarvestLossTrackerWorkspace() {
  return <CrudWorkspace config={config} />;
}
