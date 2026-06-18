import CrudWorkspace from "@/components/CrudWorkspace";
import { Landmark } from "lucide-react";

export default function LoanProductsWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "loan-products",
        title: "Loan Products",
        subtitle: "Product catalog — personal, mortgage, auto, agriculture, SME, corporate loans",
        icon: Landmark,
        accentColor: "text-amber-600",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "type"],
        apiBase: "/api/db/loans",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID", sortable: true },
          { key: "name", label: "Product Name", sortable: true },
          { key: "type", label: "Type", sortable: true },
          { key: "minAmount", label: "Min (₦)", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "maxAmount", label: "Max (₦)", render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "baseRate", label: "Rate %", render: (v) => `${v}%` },
          { key: "maxDTI", label: "Max DTI %", render: (v) => `${v}%` },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "name", label: "Product Name", type: "text", required: true },
          { key: "type", label: "Type", type: "select", options: ["personal", "mortgage", "auto", "education", "agriculture", "sme", "corporate"], required: true },
          { key: "baseRate", label: "Base Rate %", type: "number", required: true },
          { key: "minAmount", label: "Min Amount", type: "number" },
          { key: "maxAmount", label: "Max Amount", type: "number" },
        ],
      }}
    />
  );
}
