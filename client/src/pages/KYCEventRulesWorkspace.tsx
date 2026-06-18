import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Zap } from "lucide-react";

const config: CrudConfig = {
  domainKey: "kyc-event-rules",
  title: "KYC/KYB Event Trigger Rules",
  subtitle: "Kafka event-driven rules that auto-trigger KYC/KYB verification on account opening, loans, trade finance, payments, and more",
  icon: Zap,
  accentColor: "cyan",
  fields: [
    { key: "eventName", label: "Event Name", type: "text", required: true },
    { key: "kafkaTopic", label: "Kafka Topic", type: "text", required: true },
    { key: "kycLevel", label: "KYC Level", type: "select", options: ["basic", "standard", "enhanced", "full_edd"] },
    { key: "description", label: "Description", type: "text" },
  ],
  columns: [
    { key: "id", label: "Rule ID", sortable: true },
    { key: "eventName", label: "Event", sortable: true },
    { key: "kafkaTopic", label: "Kafka Topic", sortable: true },
    { key: "kycLevel", label: "KYC Level", sortable: true },
    { key: "triggerCondition", label: "Condition" },
    { key: "autoTrigger", label: "Auto" },
    { key: "enabled", label: "Enabled", sortable: true },
    { key: "cooldownHours", label: "Cooldown (hrs)" },
  ],
  idField: "id",
  statusField: "enabled",
  searchFields: ["eventName", "kafkaTopic", "kycLevel", "triggerCondition"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
  actions: [
    { label: "Toggle", key: "toggle" },
  ],
};

export default function KYCEventRulesWorkspace() {
  return <CrudWorkspace config={config} />;
}
