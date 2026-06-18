import CrudWorkspace from "@/components/CrudWorkspace";
import { FileSearch } from "lucide-react";

export default function SignatureVerificationWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "signature-verification",
        title: "Signature Verification",
        subtitle: "Biometric matching, pattern analysis, fraud detection (Rust :8180)",
        icon: FileSearch,
        accentColor: "text-pink-600",
        idField: "id",
        statusField: "status",
        searchFields: ["customer_name", "signature_type"],
        apiBase: "/api/db/certificates",
        pageSize: 25,
        columns: [
          { key: "id", label: "Record ID" },
          { key: "customer_name", label: "Customer", sortable: true },
          { key: "signature_type", label: "Type", sortable: true },
          { key: "verification_method", label: "Method", sortable: true },
          { key: "confidence_score", label: "Confidence %", sortable: true },
          { key: "document_type", label: "Document", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
