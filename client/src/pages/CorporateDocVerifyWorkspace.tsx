import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";
const config: CrudConfig = {
  domainKey: "corporate-doc-verify", title: "Corporate Document Verification",
  subtitle: "MEMART, board resolution, Tax Clearance Certificate (TCC), PENCOM — OCR extraction, cross-validation with CAC records, expiry tracking.",
  icon: FileText, accentColor: "violet",
  fields: [
    { key: "companyId", label: "Company ID", type: "text", required: true },
    { key: "docType", label: "Document Type", type: "select", options: ["MEMART", "Board Resolution", "TCC", "PENCOM", "Certificate of Incorporation"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "companyId", label: "Company", sortable: true },
    { key: "docType", label: "Document Type", sortable: true }, { key: "ocrExtracted", label: "OCR Extracted" },
    { key: "verified", label: "Verified" },
  ],
  idField: "id", statusField: "verified", searchFields: ["companyId", "docType"],
  apiBase: "/api/db/accounts",
};
export default function CorporateDocVerifyWorkspace() { return <CrudWorkspace config={config} />; }
