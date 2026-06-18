import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";
const config: CrudConfig = {
  domainKey: "kyc-data-quality", title: "KYC Data Quality Monitoring",
  subtitle: "Completeness scores, expired document alerts, duplicate BVN detection, missing NIN tracking, reconciliation against NIBSS/NIMC records.",
  icon: Shield, accentColor: "yellow",
  fields: [],
  columns: [
    { key: "totalCustomers", label: "Total Customers" }, { key: "kycComplete", label: "KYC Complete" },
    { key: "kycCompletePct", label: "Completion %" }, { key: "expiredDocuments", label: "Expired Docs" },
    { key: "duplicateBVN", label: "Duplicate BVN" }, { key: "missingNIN", label: "Missing NIN" },
  ],
  idField: "totalCustomers", searchFields: [],
  apiBase: "/api/db/kyc-data-quality-metrics",
};
export default function KYCDataQualityWorkspace() { return <CrudWorkspace config={config} />; }
