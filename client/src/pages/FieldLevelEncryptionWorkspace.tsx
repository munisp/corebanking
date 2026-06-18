import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Lock } from "lucide-react";
const config: CrudConfig = {
  domainKey: "field-level-encryption", title: "Field-Level Encryption",
  subtitle: "Per-field AES-256-GCM encryption, format-preserving encryption (FPE-FF1), data classification, automatic masking.",
  icon: Lock, accentColor: "teal",
  fields: [
    { key: "tableName", label: "Table Name", type: "text", required: true },
    { key: "fieldName", label: "Field Name", type: "text", required: true },
    { key: "algorithm", label: "Algorithm", type: "select", options: ["AES-256-GCM", "FPE-FF1"] },
    { key: "dataClassification", label: "Classification", type: "select", options: ["public", "internal", "confidential", "restricted", "pci_cardholder", "pii_sensitive"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "tableName", label: "Table", sortable: true },
    { key: "fieldName", label: "Field", sortable: true },
    { key: "algorithm", label: "Algorithm" },
    { key: "dataClassification", label: "Class" },
    { key: "maskPattern", label: "Mask" },
    { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/crypto-keys",
};
export default function FieldLevelEncryptionWorkspace() { return <CrudWorkspace config={config} />; }
