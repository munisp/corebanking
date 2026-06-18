import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileCheck } from "lucide-react";
const config: CrudConfig = {
  domainKey: "certificate-manager", title: "Certificate Manager",
  subtitle: "X.509 certificate lifecycle: internal CA, mTLS, CRL, OCSP, expiry alerting, automated renewal.",
  icon: FileCheck, accentColor: "lime",
  fields: [
    { key: "commonName", label: "Common Name", type: "text", required: true },
    { key: "type", label: "Type", type: "select", options: ["server", "client", "mtls_server", "root_ca", "intermediate_ca"], required: true },
    { key: "algorithm", label: "Algorithm", type: "select", options: ["RSA-2048-SHA256", "RSA-4096-SHA512", "ECDSA-P256-SHA256", "Ed25519"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true },
    { key: "commonName", label: "CN", sortable: true },
    { key: "type", label: "Type", sortable: true },
    { key: "algorithm", label: "Algorithm" },
    { key: "issuer", label: "Issuer" },
    { key: "status", label: "Status", sortable: true },
    { key: "validTo", label: "Expires" },
  ],
  idField: "id", statusField: "status", searchFields: ["id", "status"],
  apiBase: "/api/db/certificates",
};
export default function CertificateManagerWorkspace() { return <CrudWorkspace config={config} />; }
