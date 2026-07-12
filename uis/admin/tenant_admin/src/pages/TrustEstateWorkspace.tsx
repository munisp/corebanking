import CrudWorkspace from "@/components/CrudWorkspace";
import { ScrollText } from "lucide-react";

export default function TrustEstateWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "trust-estate",
        title: "Trust & Estate",
        subtitle: "Trusts, wills, estate administration, beneficiaries",
        icon: ScrollText,
        accentColor: "text-emerald-800",
        idField: "id",
        statusField: "status",
        searchFields: ["trust_name", "trust_type", "settlor"],
        apiBase: "/trust-estate/v1/trusts",
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
        fields: [
          {
            key: "trust_name",
            label: "Trust Name",
            type: "text",
            required: true,
            placeholder: "e.g. The Okonkwo Family Trust",
          },
          {
            key: "trust_type",
            label: "Trust Type",
            type: "select",
            required: true,
            options: [
              "Revocable",
              "Irrevocable",
              "Testamentary",
              "Living",
              "Charitable",
              "Special Needs",
              "Blind",
              "Asset Protection",
            ],
          },
          {
            key: "settlor",
            label: "Settlor",
            type: "text",
            required: true,
            placeholder: "Name of the person establishing the trust",
          },
          {
            key: "trustee",
            label: "Trustee",
            type: "text",
            required: true,
            placeholder: "Name of the appointed trustee",
          },
          {
            key: "co_trustee",
            label: "Co-Trustee",
            type: "text",
            placeholder: "Optional co-trustee",
          },
          {
            key: "corpus_value",
            label: "Corpus Value",
            type: "number",
            required: true,
            min: 0,
            placeholder: "0",
          },
          {
            key: "currency",
            label: "Currency",
            type: "select",
            required: true,
            options: ["NGN", "USD", "GBP", "EUR"],
            defaultValue: "NGN",
          },
          {
            key: "jurisdiction",
            label: "Jurisdiction",
            type: "text",
            placeholder: "e.g. Lagos, Nigeria",
          },
          {
            key: "governing_law",
            label: "Governing Law",
            type: "text",
            placeholder: "e.g. Nigerian Law",
          },
          {
            key: "establishment_date",
            label: "Establishment Date",
            type: "date",
          },
          {
            key: "termination_date",
            label: "Termination Date",
            type: "date",
          },
          {
            key: "beneficiaries",
            label: "Beneficiaries",
            type: "textarea",
            placeholder: "List names and relationships of beneficiaries...",
          },
          {
            key: "purpose",
            label: "Purpose / Objectives",
            type: "textarea",
            placeholder: "Describe the purpose and objectives of the trust...",
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            required: true,
            options: ["pending", "active", "inactive", "dissolved"],
            defaultValue: "pending",
          },
        ],
        actions: [
          { label: "View Details", key: "details" },
          { label: "Add Asset", key: "add-asset", condition: (r) => r.status === "active" },
          { label: "Distribute", key: "distribute", condition: (r) => r.status === "active" },
          {
            label: "Dissolve",
            key: "dissolve",
            variant: "destructive",
            condition: (r) => r.status === "active",
          },
        ],
      }}
    />
  );
}
