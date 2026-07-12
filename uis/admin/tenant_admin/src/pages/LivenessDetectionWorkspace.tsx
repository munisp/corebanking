import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";

const config: CrudConfig = {
  domainKey: "liveness-detection",
  title: "Liveness Detection Engine",
  subtitle: "5-method ensemble anti-spoofing — passive 3D, texture analysis, depth estimation, challenge-response, deepfake detection (iBeta Level 2)",
  icon: ShieldCheck,
  accentColor: "emerald",
  fields: [
    { key: "customer_id", label: "Customer ID", type: "text", required: true },
    { key: "device_platform", label: "Platform", type: "select", options: ["ios", "android", "web"] },
  ],
  columns: [
    { key: "id", label: "Check ID", sortable: true },
    { key: "customer_id", label: "Customer", sortable: true },
    { key: "overall_score", label: "Liveness Score", sortable: true },
    { key: "passed", label: "Passed" },
    { key: "deepfake_probability", label: "Deepfake Prob", sortable: true },
    { key: "spoof_type_detected", label: "Spoof Detected" },
    { key: "challenge_type", label: "Challenge" },
    { key: "device_platform", label: "Platform" },
    { key: "processing_time_ms", label: "Time (ms)", sortable: true },
  ],
  idField: "id",
  statusField: "passed",
  searchFields: ["customer_id", "spoof_type_detected", "device_platform"],
  apiBase: "/biometric/v1/liveness/checks",
  pageSize: 25,
};

export default function LivenessDetectionWorkspace() {
  return <CrudWorkspace config={config} />;
}
