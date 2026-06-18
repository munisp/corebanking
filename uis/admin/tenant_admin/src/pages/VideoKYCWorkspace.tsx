import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ScanEye } from "lucide-react";
const config: CrudConfig = {
  domainKey: "video-kyc", title: "Video KYC",
  subtitle: "Remote onboarding via live video interview, AI-powered analysis, screen recording with watermark, geo-fencing, CBN compliance recording.",
  icon: ScanEye, accentColor: "rose",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "officerId", label: "Officer ID", type: "text", required: true },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "customerId", label: "Customer", sortable: true },
    { key: "officerId", label: "Officer" }, { key: "duration", label: "Duration (s)" },
    { key: "geoVerified", label: "Geo Verified" }, { key: "aiAnalysis", label: "AI Result" },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["customerId", "officerId"],
  apiBase: "/video-kyc/v1/sessions",
};
export default function VideoKYCWorkspace() { return <CrudWorkspace config={config} />; }
