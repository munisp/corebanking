import { TrendingUp } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "rate-cascade",
  title: "Rate Cascade Engine",
  subtitle: "Benchmark rate changes propagate to all linked products and accounts automatically",
  icon: TrendingUp,
  accentColor: "purple",
  fields: [
    { key: "code", label: "Code", type: "readonly" },
    { key: "name", label: "Benchmark Name", type: "readonly" },
    { key: "currentRate", label: "Rate %", type: "readonly" },
  ],
  columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Benchmark Name" },
    { key: "currentRate", label: "Current %" },
    { key: "previousRate", label: "Previous %" },
    { key: "source", label: "Source" },
    { key: "linkedProducts", label: "Products" },
    { key: "linkedAccounts", label: "Accounts" },
  ],
  idField: "code",
  searchFields: ["code", "name", "source"],
  apiBase: "/api/db/fx-trades",
};

export default function RateCascadeWorkspace() {
  return <CrudWorkspace config={config} />;
}
