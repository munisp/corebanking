import CrudWorkspace from "@/components/CrudWorkspace";
import { FileWarning } from "lucide-react";

export default function FATCACRSWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "fatca-crs",
        title: "FATCA/CRS Compliance",
        subtitle: "FATCA/CRS reporting, account classification, IRS/OECD filing (Rust :8188)",
        icon: FileWarning,
        accentColor: "text-orange-800",
        idField: "id",
        statusField: "status",
        searchFields: ["report_type", "jurisdiction"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Report ID" },
          { key: "report_type", label: "Type", sortable: true },
          { key: "reporting_year", label: "Year", sortable: true },
          { key: "jurisdiction", label: "Jurisdiction", sortable: true },
          { key: "accounts_reported", label: "Accounts", sortable: true },
          { key: "total_balance", label: "Balance", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "filing_deadline", label: "Deadline", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
