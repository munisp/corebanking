import { ShieldCheck } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "agricultural-insurance",
  title: "Crop Insurance Policies",
  subtitle: "Weather-indexed insurance, claim processing, and premium calculations",
  icon: ShieldCheck,
  accentColor: "bg-green-700",
  idField: "id",
  statusField: "status",
  searchFields: ["policyId", "farmerId", "cropType"],
  apiBase: "/api/db/crop-insurance",
  fields: [
    { key: "farmerId", label: "Farmer ID", type: "text", required: true },
    { key: "cropType", label: "Crop Type", type: "select", options: ["maize", "cassava", "rice", "yam", "cocoa", "palm_oil", "sorghum", "millet"], required: true },
    { key: "coverageAmount", label: "Coverage Amount (₦)", type: "number", required: true },
    { key: "premiumAmount", label: "Premium Amount (₦)", type: "number", required: true },
    { key: "farmSizeHectares", label: "Farm Size (hectares)", type: "number", required: true },
    { key: "season", label: "Season", type: "select", options: ["2025-wet", "2025-dry", "2026-wet", "2026-dry"] },
  ],
  columns: [
    { key: "policyId", label: "Policy ID" },
    { key: "farmerId", label: "Farmer" },
    { key: "cropType", label: "Crop" },
    { key: "coverageAmount", label: "Coverage", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "premiumAmount", label: "Premium", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Activate", key: "activate", condition: (r) => r.status === "pending" },
    { label: "File Claim", key: "claim", condition: (r) => r.status === "active" },
  ],
};

export default function AgriculturalInsuranceWorkspace() {
  return <CrudWorkspace config={config} />;
}
