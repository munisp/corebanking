import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ScanLine } from "lucide-react";

const config: CrudConfig = {
  domainKey: "animal-id-traceability",
  title: "Animal ID Traceability",
  subtitle: "RFID tag tracking, movement permits and disease outbreak mapping",
  icon: ScanLine,
  accentColor: "lime",
  apiBase: "/api/db/animal-id-traceability",
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
    { key: "category", label: "Species" },
    { key: "amount", label: "Count" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AnimalIdTraceabilityWorkspace() {
  return <CrudWorkspace config={config} />;
}
