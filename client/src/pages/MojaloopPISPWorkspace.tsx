import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";
const config: CrudConfig = {
  domainKey: "mojaloop-pisp", title: "Mojaloop PISP Consents",
  subtitle: "Payment Initiation Service Provider API: FIDO2/OTP consent management for third-party payment initiation via PayStack, Flutterwave.",
  icon: Globe, accentColor: "teal",
  fields: [
    { key: "pisp", label: "PISP", type: "text", required: true },
    { key: "status", label: "Status", type: "select", options: ["active", "revoked", "pending"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "pisp", label: "PISP", sortable: true },
    { key: "dfsp", label: "DFSP" }, { key: "customerId", label: "Customer" },
    { key: "status", label: "Status", sortable: true }, { key: "credentialType", label: "Auth" },
  ],
  idField: "id", statusField: "status", searchFields: ["pisp", "status"],
  apiBase: "/api/db/transfers",
};
export default function MojaloopPISPWorkspace() { return <CrudWorkspace config={config} />; }
