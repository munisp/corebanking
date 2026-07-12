import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";
import { CreditCard } from "lucide-react";

const config: CrudConfig = {
  domainKey: "credit-facilities",
  title: "Credit Facilities / ELCM",
  subtitle: "Enterprise limit management, sub-facilities, utilization tracking and collateral coverage",
  icon: CreditCard,
  accentColor: "text-orange-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "customerName", "customerId", "riskRating"],
  apiBase: "/credit/v1/facilities",
  pageSize: 25,
  columns: [
    { key: "id", label: "Facility ID" },
    { key: "customerName", label: "Customer", sortable: true },
    { key: "customerId", label: "Customer ID" },
    { key: "type", label: "Type", sortable: true, render: (v) => String(v).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
    {
      key: "limit",
      label: "Limit",
      sortable: true,
      render: (v) => {
        const n = Number(v);
        if (n >= 1e9) return `₦${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `₦${(n / 1e6).toFixed(0)}M`;
        return `₦${n.toLocaleString()}`;
      },
    },
    {
      key: "utilized",
      label: "Utilized",
      render: (v) => {
        const n = Number(v);
        if (n >= 1e6) return `₦${(n / 1e6).toFixed(0)}M`;
        return `₦${n.toLocaleString()}`;
      },
    },
    { key: "utilizationPct", label: "Util %", render: (v) => `${Number(v).toFixed(0)}%` },
    { key: "riskRating", label: "Rating", sortable: true },
    { key: "currency", label: "CCY" },
    { key: "expiryDate", label: "Expiry" },
    { key: "status", label: "Status", sortable: true },
  ],
  fields: [
    {
      key: "customerId",
      label: "Customer ID",
      type: "text",
      required: true,
      placeholder: "Customer account / CIF number",
    },
    {
      key: "customerName",
      label: "Customer Name",
      type: "text",
      required: true,
      placeholder: "Full legal name of the customer",
    },
    {
      key: "type",
      label: "Facility Type",
      type: "select",
      required: true,
      options: ["revolving", "non-revolving"],
      defaultValue: "revolving",
    },
    {
      key: "limit",
      label: "Facility Limit (₦)",
      type: "number",
      required: true,
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
      key: "riskRating",
      label: "Risk Rating",
      type: "select",
      required: true,
      options: ["A+", "A", "A-", "BBB+", "BBB", "BB", "B", "B-", "CCC"],
      defaultValue: "BBB",
    },
    {
      key: "expiryDate",
      label: "Expiry Date",
      type: "date",
      required: true,
    },
    {
      key: "approvedBy",
      label: "Approved By",
      type: "text",
      placeholder: "Name of approving officer",
    },
    {
      key: "collateralCoveragePct",
      label: "Collateral Coverage (%)",
      type: "number",
      min: 0,
      max: 500,
      placeholder: "e.g. 125",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["active", "near-breach", "breached", "expired", "suspended"],
      defaultValue: "active",
    },
  ],
  actions: [
    { label: "View Details", key: "details" },
    { label: "Review Limit", key: "review", condition: (r) => r.status === "active" },
    { label: "Add Collateral", key: "add-collateral", condition: (r) => r.status === "active" },
    { label: "Suspend", key: "suspend", variant: "destructive", condition: (r) => r.status === "active" },
  ],
};

export default function CreditFacilitiesWorkspace() {
  return <CrudWorkspace config={config} />;
}
