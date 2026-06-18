import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileSearch } from "lucide-react";

const config: CrudConfig = {
  domainKey: "pci-scanner",
  title: "PCI-DSS Scanner",
  subtitle: "PCI-DSS compliance scanning",
  icon: FileSearch,
  accentColor: "orange",
  apiBase: "/api/db/pci-scans",
  idField: "id",
  statusField: "status",
  searchFields: ["requirement"],
  fields: [
    { key: "requirement", label: "Requirement", type: "text" },
    { key: "passing", label: "Passing", type: "number" },
    { key: "failing", label: "Failing", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "requirement", label: "Requirement" },
    { key: "passing", label: "Passing" },
    { key: "failing", label: "Failing" },
    { key: "status", label: "Status" }
  ],
};

export default function PCIScannerWorkspace() {
  return <CrudWorkspace config={config} />;
}
