import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

const config: CrudConfig = {
  domainKey: "syndicated-loans",
  title: "Syndicated Loans",
  subtitle: "Club and syndicated facilities, lead arranger management, multi-bank participation",
  icon: Users,
  accentColor: "text-blue-700",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "facility_name", "borrower", "lead_arranger"],
  apiBase: "/syndicated-loans/v1/syndicated-loans/facilities",
  pageSize: 25,
  columns: [
    { key: "id", label: "Loan ID" },
    { key: "facility_name", label: "Facility Name", sortable: true },
    { key: "borrower", label: "Borrower", sortable: true },
    { key: "lead_arranger", label: "Lead Arranger" },
    {
      key: "total_amount",
      label: "Total Amount",
      sortable: true,
      render: (v, r) => {
        const n = Number(v);
        const prefix = r.currency === "USD" ? "$" : "₦";
        if (n >= 1e9) return `${prefix}${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `${prefix}${(n / 1e6).toFixed(0)}M`;
        return `${prefix}${n.toLocaleString()}`;
      },
    },
    { key: "currency", label: "Currency" },
    { key: "interest_rate", label: "Rate (%)", render: (v) => `${v}%` },
    { key: "tenor", label: "Tenor" },
    { key: "participant_count", label: "Participants" },
    { key: "status", label: "Status", sortable: true },
  ],
  fields: [
    {
      key: "facility_name",
      label: "Facility Name",
      type: "text",
      required: true,
      placeholder: "e.g. ABC Infrastructure Syndicated Facility",
    },
    {
      key: "borrower",
      label: "Borrower",
      type: "text",
      required: true,
      placeholder: "Name of the borrowing entity",
    },
    {
      key: "lead_arranger",
      label: "Lead Arranger",
      type: "text",
      required: true,
      placeholder: "Name of the lead arranging bank",
    },
    {
      key: "total_amount",
      label: "Total Facility Amount",
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
      key: "interest_rate",
      label: "Interest Rate (% p.a.)",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      placeholder: "e.g. 14.5",
    },
    {
      key: "tenor",
      label: "Tenor",
      type: "text",
      required: true,
      placeholder: "e.g. 5 years, 36 months",
    },
    {
      key: "participant_count",
      label: "Number of Participants",
      type: "number",
      required: true,
      min: 1,
      placeholder: "e.g. 5",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      required: true,
      options: ["active", "disbursing", "closed", "restructured"],
      defaultValue: "active",
    },
  ],
  actions: [
    { label: "View Details", key: "details" },
    { label: "Add Participant", key: "add-participant", condition: (r) => r.status === "active" },
    { label: "Restructure", key: "restructure", condition: (r) => r.status === "active" },
    { label: "Close Facility", key: "close", variant: "destructive", condition: (r) => r.status !== "closed" },
  ],
};

export default function SyndicatedLoansWorkspace() {
  return <CrudWorkspace config={config} />;
}
