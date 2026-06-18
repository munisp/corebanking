import { Fingerprint } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "identity-channels",
  title: "Identity Profiles",
  subtitle: "KYC verification — BVN, NIN, passport, biometric channels",
  icon: Fingerprint,
  accentColor: "bg-violet-600",
  idField: "id",
  statusField: "verificationStatus",
  searchFields: ["profileId", "customerId", "documentNumber", "verificationType"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "verificationType", label: "Verification Type", type: "select", options: ["bvn", "nin", "passport", "voters_card", "drivers_license", "biometric"], required: true },
    { key: "documentType", label: "Document Type", type: "select", options: ["national_id", "passport", "utility_bill", "bank_statement"], required: true },
    { key: "documentNumber", label: "Document Number", type: "text", required: true },
  ],
  columns: [
    { key: "profileId", label: "Profile ID" },
    { key: "customerId", label: "Customer" },
    { key: "verificationType", label: "Type" },
    { key: "documentNumber", label: "Doc No." },
    { key: "verificationStatus", label: "Status" },
  ],
  actions: [
    { label: "Verify", key: "verify", condition: (r) => r.verificationStatus === "pending" },
    { label: "Recheck", key: "recheck", condition: (r) => r.verificationStatus === "failed" },
  ],
};

export default function IdentityChannelsWorkspace() {
  return <CrudWorkspace config={config} />;
}
