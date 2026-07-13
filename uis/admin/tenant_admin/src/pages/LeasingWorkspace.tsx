import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";
import { Package } from "lucide-react";

const config: CrudConfig = {
  domainKey: "leasing",
  title: "Leasing",
  subtitle: "Finance lease, operating lease, sale-leaseback — asset management and rental contracts",
  icon: Package,
  accentColor: "text-amber-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "lessee", "asset_description"],
  apiBase: "/leasing/v1/leasing/contracts",
  pageSize: 25,
  columns: [
    { key: "id", label: "Contract ID" },
    {
      key: "lease_type",
      label: "Type",
      sortable: true,
      render: (v) => String(v).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    },
    { key: "lessee", label: "Lessee", sortable: true },
    { key: "asset_description", label: "Asset" },
    {
      key: "asset_value",
      label: "Asset Value",
      sortable: true,
      render: (v) => {
        const n = Number(v);
        if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
        if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
        return `₦${n.toLocaleString()}`;
      },
    },
    {
      key: "monthly_rental",
      label: "Monthly Rental",
      render: (v) => {
        const n = Number(v);
        if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
        return `₦${n.toLocaleString()}`;
      },
    },
    { key: "tenor_months", label: "Tenor (mo)" },
    { key: "currency", label: "CCY" },
    { key: "status", label: "Status", sortable: true },
  ],
  fields: [
    {
      key: "lessee",
      label: "Lessee",
      type: "text",
      required: true,
      placeholder: "Name of the lessee (customer or company)",
    },
    {
      key: "lease_type",
      label: "Lease Type",
      type: "select",
      required: true,
      options: ["finance_lease", "operating_lease", "sale_leaseback"],
      defaultValue: "finance_lease",
    },
    {
      key: "asset_description",
      label: "Asset Description",
      type: "textarea",
      required: true,
      placeholder: "Describe the leased asset (make, model, serial number, etc.)",
    },
    {
      key: "asset_value",
      label: "Asset Value (₦)",
      type: "number",
      required: true,
      min: 0,
      placeholder: "0",
    },
    {
      key: "monthly_rental",
      label: "Monthly Rental (₦)",
      type: "number",
      required: true,
      min: 0,
      placeholder: "0",
    },
    {
      key: "tenor_months",
      label: "Tenor (months)",
      type: "number",
      required: true,
      min: 1,
      placeholder: "e.g. 36",
    },
    {
      key: "residual_value",
      label: "Residual Value (₦)",
      type: "number",
      min: 0,
      placeholder: "0",
    },
    {
      key: "currency",
      label: "Currency",
      type: "select",
      required: true,
      options: ["NGN", "USD", "GBP", "EUR"],
      defaultValue: "NGN",
    },
    {
      key: "commencement_date",
      label: "Commencement Date",
      type: "date",
    },
    {
      key: "maturity_date",
      label: "Maturity Date",
      type: "date",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["pending", "active", "closed", "defaulted"],
      defaultValue: "pending",
    },
  ],
  actions: [
    { label: "View Contract", key: "details" },
    { label: "Generate Schedule", key: "schedule", condition: (r) => r.status === "active" },
    { label: "Early Termination", key: "terminate", variant: "destructive", condition: (r) => r.status === "active" },
  ],
};

export default function LeasingWorkspace() {
  return <CrudWorkspace config={config} />;
}
