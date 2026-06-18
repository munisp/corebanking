import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Fingerprint } from "lucide-react";

const config: CrudConfig = {
  domainKey: "browser-fingerprint",
  title: "Browser Fingerprint",
  subtitle: "Browser device fingerprint management",
  icon: Fingerprint,
  accentColor: "blue",
  apiBase: "/api/db/device-profiles",
  idField: "id",
  statusField: "status",
  searchFields: ["fingerprintHash"],
  fields: [
    { key: "fingerprintHash", label: "Fingerprint", type: "text" },
    { key: "deviceType", label: "Device", type: "text" },
    { key: "browser", label: "Browser", type: "text" },
    { key: "trustScore", label: "Trust Score", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "fingerprintHash", label: "Fingerprint" },
    { key: "deviceType", label: "Device" },
    { key: "browser", label: "Browser" },
    { key: "trustScore", label: "Trust Score" },
    { key: "status", label: "Status" }
  ],
};

export default function BrowserFingerprintWorkspace() {
  return <CrudWorkspace config={config} />;
}
