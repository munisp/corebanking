import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Coins } from "lucide-react";
const config: CrudConfig = {
  domainKey: "tb-multicurrency", title: "TigerBeetle Multi-Currency",
  subtitle: "Multi-currency ledger with real-time FX: NGN, USD, GBP, EUR, GHS — two-phase commit for cross-currency transfers with 2ms latency.",
  icon: Coins, accentColor: "emerald",
  fields: [
    { key: "currency", label: "Currency", type: "text", required: true },
    { key: "code", label: "ISO Code", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "currency", label: "Currency", sortable: true },
    { key: "code", label: "Code" }, { key: "totalAccounts", label: "Accounts" },
    { key: "fxRateNgn", label: "FX Rate (₦)" },
  ],
  idField: "id", searchFields: ["currency"],
  apiBase: "/api/db/accounts",
};
export default function TBMultiCurrencyWorkspace() { return <CrudWorkspace config={config} />; }
