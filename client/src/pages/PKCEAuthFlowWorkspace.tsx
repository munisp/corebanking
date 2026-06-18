import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

const config: CrudConfig = {
  domainKey: "pkce-auth",
  title: "PKCE Auth Flow",
  subtitle: "OAuth2 PKCE flow for SPAs",
  icon: Shield,
  accentColor: "green",
  apiBase: "/api/db/pkce-flows",
  idField: "id",
  statusField: "status",
  searchFields: ["clientId"],
  fields: [
    { key: "clientId", label: "Client ID", type: "text" },
    { key: "codeChallengeMethod", label: "Challenge Method", type: "text" },
    { key: "activeFlows", label: "Active Flows", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "clientId", label: "Client ID" },
    { key: "codeChallengeMethod", label: "Challenge Method" },
    { key: "activeFlows", label: "Active Flows" },
    { key: "status", label: "Status" }
  ],
};

export default function PKCEAuthFlowWorkspace() {
  return <CrudWorkspace config={config} />;
}
