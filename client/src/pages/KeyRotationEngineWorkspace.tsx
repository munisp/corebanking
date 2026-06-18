import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { RefreshCw } from "lucide-react";

const config: CrudConfig = {
  domainKey: "key-rotation",
  title: "Key Rotation Engine",
  subtitle: "Automated cryptographic key rotation",
  icon: RefreshCw,
  accentColor: "purple",
  apiBase: "/api/db/key-rotations",
  idField: "id",
  statusField: "status",
  searchFields: ["keyId"],
  fields: [
    { key: "keyId", label: "Key ID", type: "text" },
    { key: "algorithm", label: "Algorithm", type: "text" },
    { key: "rotationInterval", label: "Interval", type: "text" },
    { key: "activeVersion", label: "Version", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "keyId", label: "Key ID" },
    { key: "algorithm", label: "Algorithm" },
    { key: "rotationInterval", label: "Interval" },
    { key: "activeVersion", label: "Version" },
    { key: "status", label: "Status" }
  ],
};

export default function KeyRotationEngineWorkspace() {
  return <CrudWorkspace config={config} />;
}
