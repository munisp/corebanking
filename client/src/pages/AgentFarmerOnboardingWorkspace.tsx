import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { UserPlus } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agent-farmer-onboarding",
  title: "Agent Farmer Onboarding",
  subtitle: "Field agent workflow with biometric capture and offline sync",
  icon: UserPlus,
  accentColor: "indigo",
  apiBase: "/api/db/agent-farmer-onboarding",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Type" },
    { key: "amount", label: "Count" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgentFarmerOnboardingWorkspace() {
  return <CrudWorkspace config={config} />;
}
