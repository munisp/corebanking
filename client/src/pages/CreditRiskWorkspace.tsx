import CrudWorkspace from "@/components/CrudWorkspace";
import { AlertCircle } from "lucide-react";

export default function CreditRiskWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "credit-risk",
        title: "Credit Risk Assessments",
        subtitle: "PD/LGD/EAD models, IFRS 9 staging, ECL computation, credit grades",
        icon: AlertCircle,
        accentColor: "text-red-700",
        idField: "id",
        statusField: "creditGrade",
        searchFields: ["customerName", "customerId", "creditGrade"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customerName", label: "Customer", sortable: true },
          { key: "customerType", label: "Type", sortable: true },
          { key: "creditScore", label: "Score", sortable: true },
          { key: "creditGrade", label: "Grade", sortable: true },
          { key: "pd", label: "PD", sortable: true, render: (v) => `${(Number(v) * 100).toFixed(1)}%` },
          { key: "lgd", label: "LGD", render: (v) => `${(Number(v) * 100).toFixed(0)}%` },
          { key: "ecl", label: "ECL", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "stage", label: "Stage", sortable: true },
          { key: "collateralCoverage", label: "Collateral %", render: (v) => v ? `${v}%` : "—" },
        ],
        fields: [],
      }}
    />
  );
}
