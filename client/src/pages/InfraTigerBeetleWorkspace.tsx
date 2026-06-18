import { Shield } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "infra-tigerbeetle",
  title: "TigerBeetle Ledger",
  subtitle: "Double-entry accounting — ACID ledger accounts, transfers, two-phase commits, trial balance",
  icon: Shield,
  accentColor: "emerald",
  fields: [
    { key: "id", label: "Account ID", type: "readonly" },
    { key: "name", label: "Account Name", type: "readonly" },
    { key: "code", label: "GL Code", type: "readonly" },
    { key: "balance", label: "Balance", type: "readonly" },
    { key: "currency", label: "Currency", type: "readonly" },
    { key: "user_data", label: "Category", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Account" },
    { key: "code", label: "Code" },
    { key: "balance", label: "Balance" },
    { key: "currency", label: "Currency" },
    { key: "user_data", label: "Category" },
  ],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function InfraTigerBeetleWorkspace() {
  return <CrudWorkspace config={config} />;
}
