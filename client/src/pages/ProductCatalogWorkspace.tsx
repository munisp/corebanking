import CrudWorkspace from "@/components/CrudWorkspace";
import { Package } from "lucide-react";

export default function ProductCatalogWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "product-catalog",
        title: "Product Catalog",
        subtitle: "Account, loan, card, FX, investment products — pricing, eligibility, features",
        icon: Package,
        accentColor: "text-purple-700",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "category", "subcategory", "description"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Product", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "subcategory", label: "Sub" },
          { key: "interestRate", label: "Rate %", render: (v) => v ? `${v}%` : "—" },
          { key: "kycTier", label: "KYC Tier" },
          { key: "customerCount", label: "Customers", sortable: true, render: (v) => Number(v).toLocaleString() },
          { key: "status", label: "Status", sortable: true },
          { key: "launchDate", label: "Launched" },
        ],
        fields: [
          { key: "name", label: "Product Name", type: "text", required: true },
          { key: "category", label: "Category", type: "select", options: ["deposit", "loan", "card", "fx", "investment", "insurance", "digital"], required: true },
          { key: "description", label: "Description", type: "text", required: true },
        ],
      }}
    />
  );
}
