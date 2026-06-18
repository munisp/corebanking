import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Building2 } from "lucide-react";
const config: CrudConfig = {
  domainKey: "cac-verification", title: "CAC Real-Time Company Verification",
  subtitle: "Corporate Affairs Commission RC lookup, director BVN/NIN verification, annual returns status, Post-No-Debit checks.",
  icon: Building2, accentColor: "indigo",
  fields: [
    { key: "rcNumber", label: "RC Number", type: "text", required: true },
    { key: "companyName", label: "Company Name", type: "text" },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "companyName", label: "Company", sortable: true },
    { key: "rcNumber", label: "RC Number" }, { key: "status", label: "Status", sortable: true },
    { key: "annualReturnsUpToDate", label: "Annual Returns" },
  ],
  idField: "id", statusField: "status", searchFields: ["companyName", "rcNumber"],
  apiBase: "/api/db/accounts",
};
export default function CACVerificationWorkspace() { return <CrudWorkspace config={config} />; }
