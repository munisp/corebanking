import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ScanEye } from "lucide-react";
const config: CrudConfig = {
  domainKey: "kyc-enhanced-summary", title: "KYC/KYB Enhanced Suite Summary",
  subtitle: "22 enhancements across 5 phases — 22 polyglot services (Go/Rust/Python), full 14-middleware integration (Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify, Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse).",
  icon: ScanEye, accentColor: "violet",
  fields: [],
  columns: [
    { key: "totalNewServices", label: "New Services" }, { key: "languages", label: "Languages" },
    { key: "tierDefinitions", label: "Tiers" }, { key: "monitoringRules", label: "Rules" },
    { key: "sanctionsLists", label: "Lists" }, { key: "uboEntities", label: "UBO Entities" },
  ],
  idField: "totalNewServices", searchFields: [],
  apiBase: "/api/db/accounts",
};
export default function KYCEnhancedSummaryWorkspace() { return <CrudWorkspace config={config} />; }
