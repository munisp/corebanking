import { CreditCard } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "credit-facilities",
  title: "Credit Facilities / ELCM",
  subtitle: "Enterprise limit and collateral management — facility structures, sub-facilities, utilization tracking",
  icon: CreditCard,
  accentColor: "orange",
  fields: [
    { key: "id", label: "Facility ID", type: "readonly" },
    { key: "customerName", label: "Customer", type: "readonly" },
    { key: "type", label: "Type", type: "select", options: ["revolving", "non-revolving"] },
  ],
  columns: [
    { key: "id", label: "Facility ID" },
    { key: "customerName", label: "Customer" },
    { key: "type", label: "Type" },
    { key: "limit", label: "Limit ₦" },
    { key: "utilized", label: "Utilized ₦" },
    { key: "status", label: "Status" },
    { key: "riskRating", label: "Rating" },
  ],
  idField: "id",
  searchFields: ["id", "customerName", "type", "status"],
  apiBase: "/api/db/accounts",
};

export default function CreditFacilitiesWorkspace() {
  return <CrudWorkspace config={config} />;
}
