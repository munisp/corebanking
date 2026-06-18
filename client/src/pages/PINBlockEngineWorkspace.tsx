import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";
const config: CrudConfig = {
  domainKey: "pin-block-engine", title: "PIN Block Engine",
  subtitle: "ISO 9564 PIN block encryption/translation. Formats 0/1/3/4, ANSI X9.8 compliance, zone key translation.",
  icon: Lock, accentColor: "red",
  fields: [
    { key: "format", label: "Format", type: "select", options: ["ISO-0", "ISO-1", "ISO-3", "ISO-4"], required: true },
    { key: "keyId", label: "Key ID", type: "text", required: true },
    { key: "channel", label: "Channel", type: "select", options: ["atm", "pos", "mobile", "web"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "format", label: "Format", sortable: true },
    { key: "panMasked", label: "PAN (masked)" },
    { key: "keyId", label: "Key ID" },
    { key: "channel", label: "Channel" },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/pin-hashes",
};
export default function PINBlockEngineWorkspace() { return <CrudWorkspace config={config} />; }
