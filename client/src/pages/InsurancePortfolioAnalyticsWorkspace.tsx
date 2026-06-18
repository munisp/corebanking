import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { PieChart } from "lucide-react";

const config: CrudConfig = {
  domainKey: "insurance-portfolio-analytics",
  title: "Insurance Portfolio Analytics",
  subtitle: "Loss ratio, combined ratio and geographic risk concentration",
  icon: PieChart,
  accentColor: "red",
  apiBase: "/api/db/insurance-portfolio-analytics",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Type", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Metric" },
    { key: "amount", label: "Value" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function InsurancePortfolioAnalyticsWorkspace() {
  return <CrudWorkspace config={config} />;
}
