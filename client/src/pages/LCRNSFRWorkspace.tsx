import { BarChart2 } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "lcr-nsfr",
  title: "LCR / NSFR Calculator",
  subtitle: "Basel III Liquidity Coverage Ratio and Net Stable Funding Ratio computation",
  icon: BarChart2,
  accentColor: "indigo",
  fields: [
    { key: "date", label: "Report Date", type: "readonly" },
    { key: "lcr", label: "LCR %", type: "readonly" },
    { key: "nsfr", label: "NSFR %", type: "readonly" },
  ],
  columns: [
    { key: "date", label: "Report Date" },
    { key: "lcr", label: "LCR %" },
    { key: "nsfr", label: "NSFR %" },
  ],
  idField: "date",
  searchFields: ["date"],
  apiBase: "/api/db/fx-trades",
};

export default function LCRNSFRWorkspace() {
  return <CrudWorkspace config={config} />;
}
