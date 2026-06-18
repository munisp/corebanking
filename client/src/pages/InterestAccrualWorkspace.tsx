import CrudWorkspace from "@/components/CrudWorkspace";
import { Percent } from "lucide-react";

export default function InterestAccrualWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "interest-accrual",
        title: "Interest Accrual",
        subtitle: "Daily accrual computation — savings, FDs, loans, overdrafts (365/360 basis)",
        icon: Percent,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["accountNumber", "accountName", "productType"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "accountNumber", label: "Account No" },
          { key: "accountName", label: "Customer", sortable: true },
          { key: "productType", label: "Product", sortable: true },
          { key: "principal", label: "Principal", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "annualRate", label: "Rate %", sortable: true, render: (v) => `${v}%` },
          { key: "accrualBasis", label: "Basis" },
          { key: "dailyAccrual", label: "Daily", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "mtdAccrual", label: "MTD", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "ytdAccrual", label: "YTD", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
