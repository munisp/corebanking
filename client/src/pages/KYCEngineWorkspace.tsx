import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ScanEye } from "lucide-react";

const config: CrudConfig = {
  domainKey: "kyc-engine",
  title: "KYC Verification Engine",
  subtitle: "PaddleOCR-VL 1.5 document OCR, IBM Docling parsing, VLM cross-validation, 5-method liveness, ArcFace matching",
  icon: ScanEye,
  accentColor: "violet",
  fields: [
    { key: "customer_id", label: "Customer ID", type: "text", required: true },
    { key: "customer_name", label: "Customer Name", type: "text", required: true },
    { key: "document_type", label: "Document Type", type: "select", options: ["nin_slip", "bvn_printout", "international_passport", "national_id_card", "voters_card", "drivers_license"] },
  ],
  columns: [
    { key: "id", label: "Verification ID", sortable: true },
    { key: "customer_name", label: "Customer", sortable: true },
    { key: "document_type", label: "Document Type", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "ocr_confidence", label: "OCR Confidence" },
    { key: "liveness_score", label: "Liveness Score" },
    { key: "face_match_score", label: "Face Match" },
    { key: "risk_level", label: "Risk Level", sortable: true },
    { key: "risk_score", label: "Risk Score", sortable: true },
  ],
  idField: "id",
  statusField: "status",
  searchFields: ["customer_name", "customer_id", "document_type", "status"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function KYCEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
