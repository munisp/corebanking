import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Users } from "lucide-react";
const config: CrudConfig = {
  domainKey: "kyc-self-service", title: "Customer Self-Service KYC Portal",
  subtitle: "KYC status page, document re-upload portal, renewal notifications, expiry countdown, tier upgrade self-assessment.",
  icon: Users, accentColor: "blue",
  fields: [],
  columns: [{ key: "id", label: "ID" }, { key: "customerName", label: "Customer" }, { key: "status", label: "Status" }],
  idField: "id", statusField: "status", searchFields: ["customerName"],
  apiBase: "/api/db/kyc-tiers",
};
export default function KYCSelfServiceWorkspace() { return <CrudWorkspace config={config} />; }
