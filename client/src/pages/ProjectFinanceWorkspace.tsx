import CrudWorkspace from "@/components/CrudWorkspace";
import { Building2 } from "lucide-react";

export default function ProjectFinanceWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "project-finance",
        title: "Project Finance",
        subtitle: "Infrastructure financing, SPV, DSCR, milestone disbursement (Go :8172)",
        icon: Building2,
        accentColor: "text-cyan-700",
        idField: "id",
        statusField: "status",
        searchFields: ["project_name", "sponsor"],
        apiBase: "/api/db/loans",
        pageSize: 25,
        columns: [
          { key: "id", label: "Project ID" },
          { key: "project_name", label: "Project", sortable: true },
          { key: "sponsor", label: "Sponsor", sortable: true },
          { key: "sector", label: "Sector", sortable: true },
          { key: "total_cost", label: "Cost", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "dscr", label: "DSCR", sortable: true },
          { key: "tenor", label: "Tenor" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
