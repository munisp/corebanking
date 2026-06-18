import { TrendingUp } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "fx-revaluation",
  title: "Multi-Currency Revaluation",
  subtitle: "Foreign currency position revaluation with P&L posting to GL",
  icon: TrendingUp,
  accentColor: "teal",
  fields: [
    { key: "id", label: "Position ID", type: "readonly" },
    { key: "currency", label: "Currency", type: "readonly" },
    { key: "accountType", label: "Type", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "Position ID" },
    { key: "currency", label: "Currency" },
    { key: "accountType", label: "Type" },
    { key: "balance", label: "FCY Balance" },
    { key: "localEquivalent", label: "NGN Equiv." },
    { key: "revalPnL", label: "Reval P&L ₦" },
    { key: "accountCount", label: "Accounts" },
  ],
  idField: "id",
  searchFields: ["id", "currency", "accountType"],
  apiBase: "/api/db/accounts",
};

export default function FXRevaluationWorkspace() {
  return <CrudWorkspace config={config} />;
}
