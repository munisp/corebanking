import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { FileEdit } from "lucide-react";

const config: CrudConfig = {
  domainKey: "lc-amendments",
  title: "LC Amendments",
  subtitle: "Letter of Credit amendment lifecycle with MT707",
  icon: FileEdit,
  accentColor: "blue",
  idField: "id",
  searchFields: ["lcNumber", "requestedBy", "amendmentType", "status"],
  apiBase: "/api/db/letters-of-credit",
  columns: [
    { key: "id", label: "Amendment ID", sortable: true },
    { key: "lcNumber", label: "LC Number", sortable: true },
    { key: "amendmentNumber", label: "#", sortable: true },
    { key: "requestedBy", label: "Requested By", sortable: true },
    { key: "amendmentType", label: "Type", sortable: true },
    { key: "swiftRef", label: "SWIFT Ref", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  fields: [
    { key: "lcNumber", label: "LC Number", type: "text", required: true },
    { key: "requestedBy", label: "Requested By", type: "text", required: true },
    { key: "amendmentType", label: "Type", type: "select", options: ["amount_increase", "amount_decrease", "expiry_extension", "document_change", "partial_shipment", "beneficiary_change", "port_change", "terms_change"], required: true },
    { key: "description", label: "Description", type: "textarea", required: true },
    { key: "originalValue", label: "Original Value", type: "text" },
    { key: "amendedValue", label: "Amended Value", type: "text" },
    { key: "impactOnAmount", label: "Amount Impact", type: "number" },
    { key: "currency", label: "Currency", type: "select", options: ["USD", "EUR", "GBP", "NGN"] },
  ],
};

export default function LCAmendmentsWorkspace() {
  return <CrudWorkspace config={config} />;
}
