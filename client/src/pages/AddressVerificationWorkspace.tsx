import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { MapPin } from "lucide-react";
const config: CrudConfig = {
  domainKey: "address-verification", title: "Address Verification Service",
  subtitle: "GPS-tagged address capture, utility bill OCR (EKEDC/PHCN/Water), geo-matching algorithm, agent field verification dispatch.",
  icon: MapPin, accentColor: "green",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "address", label: "Declared Address", type: "text", required: true },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "customerId", label: "Customer", sortable: true },
    { key: "address", label: "Address" }, { key: "matchScore", label: "Match Score", sortable: true },
    { key: "method", label: "Method" }, { key: "status", label: "Status", sortable: true },
  ],
  idField: "id", statusField: "status", searchFields: ["customerId", "address"],
  apiBase: "/api/db/accounts",
};
export default function AddressVerificationWorkspace() { return <CrudWorkspace config={config} />; }
