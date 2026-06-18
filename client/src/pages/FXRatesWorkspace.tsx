import { TrendingUp } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "fx-rates",
  title: "FX & Rates Engine",
  subtitle: "Exchange rates, currency conversion, FX deals, rate alerts",
  icon: TrendingUp,
  accentColor: "bg-rose-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "buy_currency", "sell_currency", "deal_type", "counterparty"],
  apiBase: "/api/db/accounts",
  fields: [
    { key: "deal_type", label: "Deal Type", type: "select", options: ["spot", "forward", "swap"], required: true },
    { key: "buy_currency", label: "Buy Currency", type: "select", options: ["USD", "EUR", "GBP", "NGN"], required: true },
    { key: "sell_currency", label: "Sell Currency", type: "select", options: ["USD", "EUR", "GBP", "NGN"], required: true },
    { key: "buy_amount", label: "Buy Amount", type: "number", required: true },
    { key: "rate", label: "Rate", type: "number", required: true },
    { key: "counterparty", label: "Counterparty", type: "text" },
    { key: "value_date", label: "Value Date", type: "text", defaultValue: "T+2" },
    { key: "trader_id", label: "Trader ID", type: "text" },
  ],
  columns: [
    { key: "id", label: "Deal ID" },
    { key: "deal_type", label: "Type" },
    { key: "buy_currency", label: "Buy" },
    { key: "sell_currency", label: "Sell" },
    { key: "buy_amount", label: "Buy Amount", render: (v) => Number(v).toLocaleString() },
    { key: "sell_amount", label: "Sell Amount", render: (v) => Number(v).toLocaleString() },
    { key: "rate", label: "Rate" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Confirm", key: "confirm", condition: (r) => r.status === "pending" },
    { label: "Cancel", key: "cancel", condition: (r) => r.status === "pending" },
    { label: "Settle", key: "settle", condition: (r) => r.status === "confirmed" },
  ],
};

export default function FXRatesWorkspace() {
  return <CrudWorkspace config={config} />;
}
