import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShoppingCart } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agri-input-marketplace",
  title: "Agricultural Input Marketplace",
  subtitle: "Seed, fertilizer, herbicide and equipment marketplace",
  icon: ShoppingCart,
  accentColor: "emerald",
  apiBase: "/api/db/agri-input-marketplace",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "amount", label: "Price", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "amount", label: "Price (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgriInputMarketplaceWorkspace() {
  return <CrudWorkspace config={config} />;
}
