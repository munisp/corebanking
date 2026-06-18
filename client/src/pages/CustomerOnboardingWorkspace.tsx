import CrudWorkspace from "@/components/CrudWorkspace";
import { UserPlus } from "lucide-react";

export default function CustomerOnboardingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "customer-onboarding",
        title: "Customer Onboarding",
        subtitle: "KYC tiered onboarding — BVN/NIN verification, liveness check, document upload",
        icon: UserPlus,
        accentColor: "text-teal-600",
        idField: "id",
        statusField: "status",
        searchFields: ["firstName", "lastName", "bvn", "phone", "email", "state"],
        apiBase: "/api/db/customers",
        pageSize: 25,
        columns: [
          { key: "id", label: "App ID" },
          { key: "firstName", label: "First Name", sortable: true },
          { key: "lastName", label: "Last Name", sortable: true },
          { key: "tier", label: "Tier" },
          { key: "productType", label: "Product" },
          { key: "bvnVerified", label: "BVN", render: (v) => v ? "Verified" : "Pending" },
          { key: "ninVerified", label: "NIN", render: (v) => v ? "Verified" : "Pending" },
          { key: "riskScore", label: "Risk", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "createdAt", label: "Applied", sortable: true },
        ],
        fields: [
          { key: "firstName", label: "First Name", type: "text", required: true },
          { key: "lastName", label: "Last Name", type: "text", required: true },
          { key: "email", label: "Email", type: "text", required: true },
          { key: "phone", label: "Phone", type: "text", required: true },
          { key: "bvn", label: "BVN", type: "text", required: true },
          { key: "productType", label: "Product", type: "select", options: ["savings", "current", "domiciliary", "fixed_deposit"], required: true },
        ],
      }}
    />
  );
}
