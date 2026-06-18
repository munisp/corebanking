import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "kyc-service-gates",
  title: "KYC Service Gates",
  subtitle: "Cross-service KYC/KYB enforcement gates — 20 services integrated with identity verification checkpoints",
  icon: ShieldCheck,
  accentColor: "red",
  fields: [],
  columns: [
    { key: "serviceName", label: "Service", sortable: true },
    { key: "port", label: "Port", sortable: true },
    { key: "kycRequired", label: "KYC Required" },
    { key: "kybRequired", label: "KYB Required" },
    { key: "minimumKYCLevel", label: "Min KYC Level", sortable: true },
    { key: "gateStatus", label: "Gate Status", sortable: true },
    { key: "blockOnFailure", label: "Block on Fail" },
    { key: "enforcedEndpoints", label: "Enforced Endpoints" },
  ],
  idField: "serviceId",
  statusField: "gateStatus",
  searchFields: ["serviceName", "serviceId", "minimumKYCLevel", "gateStatus"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
  actions: [
    { label: "Toggle Gate", key: "toggle" },
  ],
};

export default function KYCServiceGatesWorkspace() {
  return <CrudWorkspace config={config} />;
}
