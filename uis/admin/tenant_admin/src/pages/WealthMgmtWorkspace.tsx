import CrudWorkspace from "@/components/CrudWorkspace";
import { Landmark } from "lucide-react";

export default function WealthMgmtWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "wealth-mgmt",
        title: "Wealth Management",
        subtitle: "UHNW/HNW clients, investment mandates, relationship management (Python :8168)",
        icon: Landmark,
        accentColor: "text-amber-600",
        idField: "id",
        statusField: "status",
        searchFields: ["client_name", "client_type"],
        apiBase: "/user/user/tenant",
        pageSize: 25,
        columns: [
          { key: "id", label: "Client ID" },
          { key: "client_name", label: "Client", sortable: true },
          { key: "client_type", label: "Type", sortable: true },
          { key: "total_wealth", label: "Wealth (USD)", sortable: true, render: (v) => `$${Number(v).toLocaleString()}` },
          { key: "risk_profile", label: "Risk", sortable: true },
          { key: "investment_mandate", label: "Mandate", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          {
            key: "client_name",
            label: "Client Name",
            type: "text",
            required: true,
            placeholder: "Full legal name",
          },
          {
            key: "client_type",
            label: "Client Type",
            type: "select",
            required: true,
            options: ["UHNW", "HNW", "Mass Affluent", "Retail"],
          },
          {
            key: "risk_profile",
            label: "Risk Profile",
            type: "select",
            required: true,
            options: ["Conservative", "Moderate", "Balanced", "Growth", "Aggressive"],
          },
          {
            key: "investment_mandate",
            label: "Investment Mandate",
            type: "select",
            required: true,
            options: [
              "Capital Preservation",
              "Income",
              "Balanced",
              "Growth",
              "Aggressive Growth",
            ],
          },
          {
            key: "total_wealth",
            label: "Total Wealth (USD)",
            type: "number",
            required: true,
            min: 0,
            placeholder: "0",
          },
          {
            key: "primary_currency",
            label: "Primary Currency",
            type: "select",
            required: true,
            options: ["NGN", "USD", "GBP", "EUR"],
            defaultValue: "USD",
          },
          {
            key: "relationship_manager",
            label: "Relationship Manager",
            type: "text",
            placeholder: "Assigned RM name",
          },
          {
            key: "investment_horizon",
            label: "Investment Horizon",
            type: "select",
            options: ["Short-term (< 2yr)", "Medium-term (2–5yr)", "Long-term (> 5yr)"],
          },
          {
            key: "onboarding_date",
            label: "Onboarding Date",
            type: "date",
          },
          {
            key: "notes",
            label: "Notes",
            type: "textarea",
            placeholder: "Any additional client notes...",
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            required: true,
            options: ["active", "pending", "inactive", "suspended"],
            defaultValue: "active",
          },
        ],
        actions: [
          { label: "View Profile", key: "profile" },
          { label: "Rebalance", key: "rebalance", condition: (r) => r.status === "active" },
          {
            label: "Suspend",
            key: "suspend",
            variant: "destructive",
            condition: (r) => r.status === "active",
          },
        ],
      }}
    />
  );
}
