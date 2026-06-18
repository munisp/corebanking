import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CreditCard } from "lucide-react";
const config: CrudConfig = {
  domainKey: "scratch-card-pins", title: "Scratch Card PINs",
  subtitle: "Scratch card PIN generation, verification, batch management with HSM-backed crypto. Nigerian banking scratch-off card pattern.",
  icon: CreditCard, accentColor: "emerald",
  fields: [
    { key: "cardType", label: "Card Type", type: "select", options: ["transaction_pin", "grid_challenge", "activation", "prepaid_value"], required: true },
    { key: "batchSize", label: "Batch Size", type: "text", required: true },
    { key: "branchCode", label: "Branch Code", type: "text", required: true },
    { key: "pinLength", label: "PIN Length", type: "select", options: ["4", "6", "8"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "serialNumber", label: "Serial Number", sortable: true },
    { key: "cardType", label: "Card Type", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "maxAttempts", label: "Max Attempts" },
    { key: "usedAttempts", label: "Used" },
    { key: "branchCode", label: "Branch" },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/scratch-cards",
};
export default function ScratchCardPINWorkspace() { return <CrudWorkspace config={config} />; }
