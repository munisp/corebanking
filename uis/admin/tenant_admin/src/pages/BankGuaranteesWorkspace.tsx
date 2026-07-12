import CrudWorkspace from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";

export default function BankGuaranteesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "bank-guarantees",
        title: "Bank Guarantees",
        subtitle: "Bid bonds, performance guarantees, advance payment, standby LC, counter guarantees",
        icon: ShieldCheck,
        accentColor: "text-violet-600",
        idField: "id",
        statusField: "status",
        searchFields: ["applicant_name", "beneficiary_name", "guarantee_type"],
        apiBase: "/trade-finance/api/v1/guarantees",
        pageSize: 25,
        columns: [
          { key: "guarantee_number", label: "Guarantee No." },
          { key: "guarantee_type", label: "Type", sortable: true },
          { key: "applicant_name", label: "Applicant", sortable: true },
          { key: "beneficiary_name", label: "Beneficiary", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v: unknown) => `₦${Number(v).toLocaleString()}` },
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
