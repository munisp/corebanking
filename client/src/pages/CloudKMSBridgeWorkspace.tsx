import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Key } from "lucide-react";

const config: CrudConfig = {
  domainKey: "cloud-kms",
  title: "Cloud KMS Bridge",
  subtitle: "AWS KMS / Azure Key Vault bridge",
  icon: Key,
  accentColor: "purple",
  apiBase: "/api/db/kms-keys",
  idField: "id",
  statusField: "status",
  searchFields: ["provider"],
  fields: [
    { key: "provider", label: "Provider", type: "text" },
    { key: "keyId", label: "Key ID", type: "text" },
    { key: "algorithm", label: "Algorithm", type: "text" },
    { key: "usage", label: "Usage", type: "text" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "provider", label: "Provider" },
    { key: "keyId", label: "Key ID" },
    { key: "algorithm", label: "Algorithm" },
    { key: "usage", label: "Usage" },
    { key: "status", label: "Status" }
  ],
};

export default function CloudKMSBridgeWorkspace() {
  return <CrudWorkspace config={config} />;
}
