import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CheckCircle } from "lucide-react";

const config: CrudConfig = {
  domainKey: "sri-validator",
  title: "SRI Validator",
  subtitle: "Subresource integrity hash management",
  icon: CheckCircle,
  accentColor: "blue",
  apiBase: "/api/db/sri-hashes",
  idField: "id",
  statusField: "status",
  searchFields: ["resource"],
  fields: [
    { key: "resource", label: "Resource", type: "text" },
    { key: "algorithm", label: "Algorithm", type: "text" },
    { key: "violations", label: "Violations", type: "number" },
    { key: "cdnProvider", label: "CDN", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "resource", label: "Resource" },
    { key: "algorithm", label: "Algorithm" },
    { key: "violations", label: "Violations" },
    { key: "cdnProvider", label: "CDN" },
    { key: "status", label: "Status" }
  ],
};

export default function SRIValidatorWorkspace() {
  return <CrudWorkspace config={config} />;
}
