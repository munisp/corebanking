import CrudWorkspace from "@/components/CrudWorkspace";
import { FileSearch } from "lucide-react";

export default function CreditBureauWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "credit-bureau",
        title: "Credit Bureau",
        subtitle: "CRC, FirstCentral, CreditRegistry — credit scores, facility history, enquiries (Rust :8151)",
        icon: FileSearch,
        accentColor: "text-orange-800",
        idField: "id",
        statusField: "status",
        searchFields: ["customer_name", "bureau", "score_band", "bvn"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customer_name", label: "Customer", sortable: true },
          { key: "bvn", label: "BVN" },
          { key: "bureau", label: "Bureau", sortable: true },
          { key: "credit_score", label: "Score", sortable: true },
          { key: "score_band", label: "Band", sortable: true },
          { key: "total_facilities", label: "Facilities" },
          { key: "total_outstanding", label: "Outstanding", sortable: true, render: (v) => { const n = Number(v); return n >= 1e9 ? `₦${(n/1e9).toFixed(1)}B` : `₦${(n/1e6).toFixed(0)}M`; } },
          { key: "total_overdue", label: "Overdue", render: (v) => Number(v) > 0 ? `₦${(Number(v)/1e6).toFixed(1)}M` : "—" },
          { key: "performing_percentage", label: "Performing %", render: (v) => `${v}%` },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
