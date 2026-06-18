import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Box } from "lucide-react";

const config: CrudConfig = {
  domainKey: "image-scanner",
  title: "Container Image Scanner",
  subtitle: "Trivy/Grype container vulnerability scanning",
  icon: Box,
  accentColor: "gray",
  apiBase: "/api/db/image-scans",
  idField: "id",
  statusField: "status",
  searchFields: ["image"],
  fields: [
    { key: "image", label: "Image", type: "text" },
    { key: "totalVulns", label: "Total Vulns", type: "number" },
    { key: "critical", label: "Critical", type: "number" },
    { key: "high", label: "High", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "image", label: "Image" },
    { key: "totalVulns", label: "Total Vulns" },
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "status", label: "Status" }
  ],
};

export default function ImageScannerWorkspace() {
  return <CrudWorkspace config={config} />;
}
