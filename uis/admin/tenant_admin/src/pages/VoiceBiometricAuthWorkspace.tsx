import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Fingerprint } from "lucide-react";

const config: CrudConfig = {
  domainKey: "voice-biometric-auth",
  title: "Voice Biometric Auth",
  subtitle: "Voiceprint enrollment, verification and anti-spoofing",
  icon: Fingerprint,
  accentColor: "red",
  apiBase: "/biometric/v1/liveness/checks",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" }
  ],
};

export default function VoiceBiometricAuthWorkspace() {
  return <CrudWorkspace config={config} />;
}
