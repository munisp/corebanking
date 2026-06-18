import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ArrowLeftRight } from "lucide-react";

const config: CrudConfig = {
  domainKey: "commodity-exchange",
  title: "Commodity Exchange Integration",
  subtitle: "NCX, AFEX, SABEX price feeds, order matching and settlement",
  icon: ArrowLeftRight,
  accentColor: "cyan",
  apiBase: "/api/db/commodity-exchange",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "exchange", label: "Exchange", type: "text" },
    { key: "commodity", label: "Commodity", type: "text" },
    { key: "lastTraded", label: "Price", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "exchange", label: "Exchange" },
    { key: "commodity", label: "Commodity" },
    { key: "bidPrice", label: "Bid" },
    { key: "askPrice", label: "Ask" },
    { key: "lastTraded", label: "Last" },
    { key: "volumeTonnes", label: "Volume" },
    { key: "status", label: "Status" }
  ],
};

export default function CommodityExchangeWorkspace() {
  return <CrudWorkspace config={config} />;
}
