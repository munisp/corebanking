import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function KYCAMLWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "kyc-aml",
        title: "KYC/AML Screening",
        subtitle: "Know Your Customer verification, BVN validation, PEP/sanctions watchlist screening, and risk scoring",
        icon: Shield,
        accentColor: "text-red-600",
        idField: "id",
        statusField: "screening_status",
        searchFields: ["full_name", "bvn", "customer_id"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID", sortable: true },
          { key: "full_name", label: "Name", sortable: true },
          { key: "bvn", label: "BVN" },
          { key: "tier", label: "Tier", sortable: true },
          { key: "risk_level", label: "Risk Level", sortable: true },
          { key: "risk_score", label: "Score", sortable: true },
          { key: "screening_status", label: "Status" },
          { key: "bvn_verified", label: "BVN Verified" },
        ],
        fields: [
          { key: "bvn", label: "BVN (11 digits)", type: "text", required: true, pattern: "^\\d{11}$" },
          { key: "fullName", label: "Full Name", type: "text", required: true },
          { key: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
          { key: "phone", label: "Phone", type: "text", required: true },
          { key: "email", label: "Email", type: "text" },
        ],
      }}
    />
  );
}
