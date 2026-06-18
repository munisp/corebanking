import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CircuitBoard } from "lucide-react";

const config: CrudConfig = {
  domainKey: "billing-orchestrator",
  title: "Billing Orchestrator",
  subtitle: "Real-time billing capture, role-based access, audit trail, tenant onboarding billing setup with Kafka/Permify/TigerBeetle",
  icon: CircuitBoard,
  accentColor: "green",
  fields: [],
  columns: [
    { key: "id", label: "Profile ID", sortable: true },
    { key: "tenantId", label: "Tenant", sortable: true },
    { key: "pricingModel", label: "Pricing Model", sortable: true },
    { key: "segment", label: "Segment", sortable: true },
    { key: "signOnFee", label: "Sign-On Fee", sortable: true },
    { key: "monthlyFee", label: "Monthly Fee", sortable: true },
    { key: "feePerTxn", label: "Fee/Txn", sortable: true },
    { key: "platformSharePct", label: "Platform %", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id",
  searchFields: ["id", "tenantId", "pricingModel", "segment", "status"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function BillingOrchestratorWorkspace() {
  return <CrudWorkspace config={config} />;
}
