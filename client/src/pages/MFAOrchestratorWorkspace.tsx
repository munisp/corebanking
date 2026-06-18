import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Fingerprint } from "lucide-react";
const config: CrudConfig = {
  domainKey: "mfa-orchestrator", title: "MFA Orchestrator",
  subtitle: "Adaptive multi-factor authentication: PIN + OTP + biometric + scratch card + grid card + hardware token. Risk-based escalation.",
  icon: Fingerprint, accentColor: "amber",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "primaryMethod", label: "Primary Method", type: "select", options: ["pin", "otp_sms", "biometric", "scratch_card", "grid_card", "hardware_token"], required: true },
    { key: "backupMethod", label: "Backup Method", type: "select", options: ["otp_sms", "otp_email", "scratch_card"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "customerId", label: "Customer", sortable: true },
    { key: "primaryMethod", label: "Primary", sortable: true },
    { key: "backupMethod", label: "Backup" },
    { key: "status", label: "Status", sortable: true },
    { key: "riskLevel", label: "Risk" },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/mfa-enrollments",
};
export default function MFAOrchestratorWorkspace() { return <CrudWorkspace config={config} />; }
