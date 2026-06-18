import { TrendingUp } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "treasury-liquidity",
  title: "Treasury & Liquidity",
  subtitle: "Cash forecasting, interbank placements, FX dealing, investment portfolio, ALM",
  icon: TrendingUp,
  accentColor: "bg-amber-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "counterparty", "placement_type", "security_type"],
  apiBase: "/api/db/fx-trades",
  fields: [
    { key: "security_type", label: "Security Type", type: "select", options: ["tbill", "bond", "commercial_paper"], required: true },
    { key: "issuer", label: "Issuer", type: "text", defaultValue: "FGN" },
    { key: "face_value", label: "Face Value (₦)", type: "number", required: true, min: 50000000 },
    { key: "purchase_price", label: "Purchase Price (₦)", type: "number", required: true },
    { key: "yield_rate", label: "Yield Rate (%)", type: "number", required: true },
    { key: "coupon_rate", label: "Coupon Rate (%)", type: "number" },
    { key: "maturity_date", label: "Maturity Date", type: "date", required: true },
    { key: "tenor_days", label: "Tenor (Days)", type: "number", defaultValue: 91 },
  ],
  columns: [
    { key: "id", label: "Investment ID" },
    { key: "security_type", label: "Type", render: (v) => String(v).toUpperCase() },
    { key: "face_value", label: "Face Value", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "market_value", label: "Market Value", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "yield_rate", label: "Yield", render: (v) => `${v}%` },
    { key: "maturity_date", label: "Maturity" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Liquidate", key: "liquidate", condition: (r) => r.status === "active" },
  ],
};

export default function TreasuryWorkspace() {
  return <CrudWorkspace config={config} />;
}
