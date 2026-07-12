import CrudWorkspace from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";

export default function InvestmentWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "investments",
        title: "Investments",
        subtitle: "Customer investment portfolio — stocks, bonds, mutual funds, real estate",
        icon: TrendingUp,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "customer_id", "investment_type", "name", "symbol"],
        apiBase: "/investment/v1/portfolios",
        pageSize: 25,
        columns: [
          { key: "id",              label: "ID" },
          { key: "customer_id",     label: "Customer",       sortable: true },
          { key: "investment_type", label: "Type",           sortable: true },
          { key: "name",            label: "Name",           sortable: true },
          { key: "symbol",          label: "Symbol" },
          { key: "units",           label: "Units",          sortable: true },
          { key: "purchase_price",  label: "Purchase Price", sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "current_price",   label: "Current Price",  sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "total_value",     label: "Total Value",    sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "profit_loss",     label: "P&L",            sortable: true,
            render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status",          label: "Status",         sortable: true },
          { key: "purchase_date",   label: "Purchase Date",  sortable: true },
        ],
        fields: [
          { key: "investment_type", label: "Investment Type", type: "text", required: true },
          { key: "name",            label: "Name",            type: "text", required: true },
          { key: "symbol",          label: "Symbol",          type: "text" },
          { key: "units",           label: "Units",           type: "number", required: true },
          { key: "purchase_price",  label: "Purchase Price",  type: "number", required: true },
        ],
      }}
    />
  );
}
