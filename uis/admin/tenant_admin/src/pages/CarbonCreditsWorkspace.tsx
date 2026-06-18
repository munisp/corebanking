import CrudWorkspace from "@/components/CrudWorkspace";
import { Leaf } from "lucide-react";

export default function CarbonCreditsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "carbon-credits",
        title: "Carbon Credits",
        subtitle: "Carbon credit projects, trades, and customer footprint offsets",
        icon: Leaf,
        accentColor: "text-teal-700",
        idField: "credit_id",
        statusField: "status",
        searchFields: ["credit_id", "project_id", "customer_id", "project_name"],
        apiBase: "/carbon/v1/credits",
        pageSize: 25,
        columns: [
          { key: "credit_id",    label: "Credit ID" },
          { key: "project_name", label: "Project",       sortable: true },
          { key: "customer_id",  label: "Customer",      sortable: true },
          { key: "quantity",     label: "Tonnes CO₂",    sortable: true,
            render: (v) => `${Number(v).toLocaleString()} t` },
          { key: "price_per_tonne", label: "Price/Tonne", sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "total_value",  label: "Total Value",   sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "vintage_year", label: "Vintage",       sortable: true },
          { key: "standard",     label: "Standard",      sortable: true },
          { key: "status",       label: "Status",        sortable: true },
          { key: "created_at",   label: "Date",          sortable: true },
        ],
        fields: [
          { key: "project_id",      label: "Project ID",    type: "text", required: true },
          { key: "quantity",        label: "Quantity (tonnes)", type: "number", required: true },
          { key: "price_per_tonne", label: "Price per Tonne (₦)", type: "number", required: true },
          { key: "vintage_year",    label: "Vintage Year",  type: "number" },
          { key: "standard",        label: "Standard",      type: "text" },
        ],
      }}
    />
  );
}
