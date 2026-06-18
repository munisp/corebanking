import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ScanFace } from "lucide-react";

const config: CrudConfig = {
  domainKey: "face-match",
  title: "Face Match Engine",
  subtitle: "ArcFace R100 embedding comparison (512-dim, cosine similarity) — selfie vs document photo, age/gender estimation, head pose analysis",
  icon: ScanFace,
  accentColor: "blue",
  fields: [
    { key: "customer_id", label: "Customer ID", type: "text", required: true },
    { key: "customer_name", label: "Customer Name", type: "text", required: true },
  ],
  columns: [
    { key: "id", label: "Match ID", sortable: true },
    { key: "customer_name", label: "Customer", sortable: true },
    { key: "similarity_score", label: "Similarity", sortable: true },
    { key: "matched", label: "Matched" },
    { key: "face_quality_score", label: "Quality", sortable: true },
    { key: "age_estimation", label: "Est. Age" },
    { key: "gender_estimation", label: "Est. Gender" },
    { key: "glasses_detected", label: "Glasses" },
    { key: "mask_detected", label: "Mask" },
    { key: "processing_time_ms", label: "Time (ms)", sortable: true },
  ],
  idField: "id",
  statusField: "matched",
  searchFields: ["customer_name", "customer_id"],
  apiBase: "/face-match/v1/matches",
  pageSize: 25,
};

export default function FaceMatchWorkspace() {
  return <CrudWorkspace config={config} />;
}
