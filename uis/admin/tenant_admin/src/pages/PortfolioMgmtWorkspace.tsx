import CrudWorkspace from "@/components/CrudWorkspace";
import { PieChart } from "lucide-react";

export default function PortfolioMgmtWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "portfolio-mgmt",
        title: "Portfolio Management",
        subtitle: "Investment portfolios, asset allocation, NAV, benchmarking, rebalancing (Rust :8167)",
        icon: PieChart,
        accentColor: "text-purple-600",
        idField: "id",
        statusField: "status",
        searchFields: ["portfolio_name", "client_name"],
        apiBase: "/portfolio/v1/portfolios",
        pageSize: 25,
        columns: [
          { key: "id", label: "Portfolio ID" },
          { key: "portfolio_name", label: "Name", sortable: true },
          { key: "client_name", label: "Client", sortable: true },
          { key: "portfolio_type", label: "Type", sortable: true },
          { key: "total_aum", label: "AUM", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "ytd_return", label: "YTD %", sortable: true },
          { key: "risk_score", label: "Risk", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          {
            key: "portfolio_name",
            label: "Portfolio Name",
            type: "text",
            required: true,
            placeholder: "e.g. Adeyemi Growth Fund",
          },
          {
            key: "client_name",
            label: "Client Name",
            type: "text",
            required: true,
            placeholder: "Owner / beneficial client",
          },
          {
            key: "portfolio_type",
            label: "Portfolio Type",
            type: "select",
            required: true,
            options: [
              "Equity",
              "Fixed Income",
              "Balanced",
              "Money Market",
              "Alternative",
              "Real Estate",
              "ETF",
              "Multi-Asset",
            ],
          },
          {
            key: "base_currency",
            label: "Base Currency",
            type: "select",
            required: true,
            options: ["NGN", "USD", "GBP", "EUR"],
            defaultValue: "NGN",
          },
          {
            key: "total_aum",
            label: "Initial AUM (₦)",
            type: "number",
            required: true,
            min: 0,
            placeholder: "0",
          },
          {
            key: "benchmark",
            label: "Benchmark Index",
            type: "text",
            placeholder: "e.g. NGX All-Share, S&P 500",
          },
          {
            key: "risk_score",
            label: "Risk Score (1–5)",
            type: "select",
            options: ["1", "2", "3", "4", "5"],
          },
          {
            key: "management_fee_pct",
            label: "Management Fee (%)",
            type: "number",
            min: 0,
            max: 10,
            placeholder: "e.g. 1.5",
          },
          {
            key: "performance_fee_pct",
            label: "Performance Fee (%)",
            type: "number",
            min: 0,
            max: 30,
            placeholder: "e.g. 20",
          },
          {
            key: "rebalancing_frequency",
            label: "Rebalancing Frequency",
            type: "select",
            options: ["Monthly", "Quarterly", "Semi-Annual", "Annual", "Ad Hoc"],
            defaultValue: "Quarterly",
          },
          {
            key: "inception_date",
            label: "Inception Date",
            type: "date",
          },
          {
            key: "investment_objective",
            label: "Investment Objective",
            type: "textarea",
            placeholder: "Describe the portfolio's stated investment objective...",
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            required: true,
            options: ["active", "pending", "suspended", "closed"],
            defaultValue: "active",
          },
        ],
        actions: [
          { label: "View Holdings", key: "holdings" },
          { label: "Rebalance", key: "rebalance", condition: (r) => r.status === "active" },
          { label: "Generate Report", key: "report" },
          {
            label: "Close Portfolio",
            key: "close",
            variant: "destructive",
            condition: (r) => r.status === "active",
          },
        ],
      }}
    />
  );
}
