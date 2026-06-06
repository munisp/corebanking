import { useState } from "react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldCheck, Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ActiveLivenessChallenge from "./ActiveLivenessChallenge";

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
  apiBase: "/api/db/kyc-verifications",
  pageSize: 25,
};

export default function LivenessDetectionWorkspace() {
  const [mode, setMode] = useState<"list" | "challenge">("list");
  const [testCustomerId] = useState(`CUST-${Date.now().toString(36).toUpperCase()}`);

  if (mode === "challenge") {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => setMode("list")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
        <ActiveLivenessChallenge
          customerId={testCustomerId}
          onComplete={(session) => {
            // Liveness session complete
            setMode("list");
          }}
          onCancel={() => setMode("list")}
          challengeCount={3}
          mode="active"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end p-4 pb-0">
        <Button onClick={() => setMode("challenge")} variant="default">
          <Camera className="w-4 h-4 mr-1" /> Start Live Liveness Check
        </Button>
      </div>
      <CrudWorkspace config={config} />
    </div>
  );
}
