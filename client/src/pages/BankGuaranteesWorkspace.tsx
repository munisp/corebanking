import CrudWorkspace from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";

export default function BankGuaranteesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "bank-guarantees",
        title: "Bank Guarantees",
        subtitle: "Bid bonds, performance guarantees, advance payment, standby LC, counter guarantees (Go :8160)",
        icon: ShieldCheck,
        accentColor: "text-violet-600",
        idField: "id",
        statusField: "status",
        searchFields: ["applicant", "beneficiary", "guarantee_type"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Guarantee ID" },
          { key: "guarantee_type", label: "Type", sortable: true },
          { key: "applicant", label: "Applicant", sortable: true },
          { key: "beneficiary", label: "Beneficiary", sortable: true },
          { key: "amount", label: "Amount (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "currency", label: "Currency" },
          { key: "issue_date", label: "Issue Date", sortable: true },
          { key: "expiry_date", label: "Expiry Date", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
