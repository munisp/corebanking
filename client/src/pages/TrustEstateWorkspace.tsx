import CrudWorkspace from "@/components/CrudWorkspace";
import { ScrollText } from "lucide-react";

export default function TrustEstateWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "trust-estate",
        title: "Trust & Estate",
        subtitle: "Trusts, wills, estate administration, beneficiaries (Rust :8185)",
        icon: ScrollText,
        accentColor: "text-emerald-800",
        idField: "id",
        statusField: "status",
        searchFields: ["trust_name", "trust_type", "settlor"],
        apiBase: "/api/db/accounts",
        pageSize: 25,
        columns: [
          { key: "id", label: "Trust ID" },
          { key: "trust_name", label: "Trust", sortable: true },
          { key: "trust_type", label: "Type", sortable: true },
          { key: "settlor", label: "Settlor", sortable: true },
          { key: "corpus_value", label: "Corpus", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "currency", label: "Currency" },
          { key: "trustee", label: "Trustee" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
