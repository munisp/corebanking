import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";
const config: CrudConfig = {
  domainKey: "hsm-key-manager", title: "HSM Key Manager",
  subtitle: "Hardware Security Module key lifecycle: AES-256, RSA-4096, ECDSA, Ed25519, DUKPT. PIN block encryption, key ceremonies.",
  icon: Key, accentColor: "violet",
  fields: [
    { key: "name", label: "Key Name", type: "text", required: true },
    { key: "keyType", label: "Key Type", type: "select", options: ["aes256", "rsa4096", "ecdsa_p256", "ed25519", "dukpt_bdk"], required: true },
    { key: "purpose", label: "Purpose", type: "select", options: ["pin_encryption", "data_encryption", "signing", "key_wrapping"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "name", label: "Key Name", sortable: true },
    { key: "keyType", label: "Type", sortable: true },
    { key: "algorithm", label: "Algorithm" },
    { key: "purpose", label: "Purpose" },
    { key: "status", label: "Status", sortable: true },
    { key: "keySizeBits", label: "Size" },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/kms-keys",
};
export default function HSMKeyManagerWorkspace() { return <CrudWorkspace config={config} />; }
