import { DollarSign } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "relationship-pricing",
  title: "Relationship Pricing Engine",
  subtitle: "Customer-level pricing based on portfolio value, segment, and profitability scoring",
  icon: DollarSign,
  accentColor: "green",
  fields: [
    { key: "id", label: "Profile ID", type: "readonly" },
    { key: "customerName", label: "Customer", type: "readonly" },
    { key: "tier", label: "Tier", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "Profile ID" },
    { key: "customerName", label: "Customer" },
    { key: "segment", label: "Segment" },
    { key: "tier", label: "Pricing Tier" },
    { key: "score", label: "Score" },
    { key: "annualRevenue", label: "Revenue ₦" },
    { key: "netRevenue", label: "Net Revenue ₦" },
  ],
  idField: "id",
  searchFields: ["id", "customerName", "segment", "tier"],
  apiBase: "/api/db/accounts",
};

export default function RelationshipPricingWorkspace() {
  return <CrudWorkspace config={config} />;
}
