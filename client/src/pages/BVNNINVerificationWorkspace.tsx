import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ScanEye } from "lucide-react";
const config: CrudConfig = {
  domainKey: "bvn-nin-verification", title: "BVN/NIN Real-Time Verification",
  subtitle: "NIBSS BVN Validation API + NIMC NIN Verification with 24-hour Redis cache. Name matching, photo similarity, BVN-NIN linkage check.",
  icon: ScanEye, accentColor: "blue",
  fields: [
    { key: "bvn", label: "BVN (11 digits)", type: "text", required: true },
    { key: "nin", label: "NIN (11 digits)", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "bvn", label: "BVN" },
    { key: "firstName", label: "First Name", sortable: true }, { key: "lastName", label: "Last Name", sortable: true },
    { key: "dob", label: "DOB" }, { key: "phone", label: "Phone" },
    { key: "ninLinked", label: "NIN Linked" }, { key: "verified", label: "Verified" },
  ],
  idField: "id", statusField: "verified", searchFields: ["bvn", "firstName", "lastName"],
  apiBase: "/api/db/accounts",
};
export default function BVNNINVerificationWorkspace() { return <CrudWorkspace config={config} />; }
