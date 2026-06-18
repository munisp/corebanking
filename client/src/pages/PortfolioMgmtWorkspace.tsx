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
        apiBase: "/api/db/accounts",
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
        fields: [],
      }}
    />
  );
}
