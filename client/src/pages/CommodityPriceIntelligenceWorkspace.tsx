import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

const config: CrudConfig = {
  domainKey: "commodity-price-intelligence",
  title: "Commodity Price Intelligence",
  subtitle: "Real-time market prices from NCX, AFEX and regional markets",
  icon: TrendingUp,
  accentColor: "sky",
  apiBase: "/api/db/commodity-price-intelligence",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "commodity", label: "Commodity", type: "text" },
    { key: "market", label: "Market", type: "text" },
    { key: "pricePerKg", label: "Price/kg", type: "number" },
    { key: "trend", label: "Trend", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "commodity", label: "Commodity" },
    { key: "market", label: "Market" },
    { key: "pricePerKg", label: "Price/kg" },
    { key: "pricePerTonne", label: "Price/t" },
    { key: "trend", label: "Trend" },
    { key: "source", label: "Source" }
  ],
};

export default function CommodityPriceIntelligenceWorkspace() {
  return <CrudWorkspace config={config} />;
}
