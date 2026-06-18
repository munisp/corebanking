import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Box } from "lucide-react";

const config: CrudConfig = {
  domainKey: "distroless-builder",
  title: "Distroless Builder",
  subtitle: "Minimal container images (2MB vs 80MB)",
  icon: Box,
  accentColor: "gray",
  apiBase: "/api/db/distroless-images",
  idField: "id",
  statusField: "status",
  searchFields: ["service"],
  fields: [
    { key: "service", label: "Service", type: "text" },
    { key: "baseImage", label: "Base Image", type: "text" },
    { key: "imageSizeMB", label: "Size MB", type: "number" },
    { key: "reductionPct", label: "Reduction", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "service", label: "Service" },
    { key: "baseImage", label: "Base Image" },
    { key: "imageSizeMB", label: "Size MB" },
    { key: "reductionPct", label: "Reduction" },
    { key: "status", label: "Status" }
  ],
};

export default function DistrolessBuilderWorkspace() {
  return <CrudWorkspace config={config} />;
}
