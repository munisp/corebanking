import { BookOpen } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "accounting-rules",
  title: "Accounting Rules Engine",
  subtitle: "Event-driven GL posting — every banking event triggers debit/credit accounting entries",
  icon: BookOpen,
  accentColor: "blue",
  fields: [
    { key: "id", label: "Rule ID", type: "readonly" },
    { key: "event", label: "Event", type: "text" },
    { key: "debitGL", label: "Debit GL", type: "text" },
    { key: "creditGL", label: "Credit GL", type: "text" },
  ],
  columns: [
    { key: "id", label: "Rule ID" },
    { key: "event", label: "Event" },
    { key: "product", label: "Product" },
    { key: "debitGL", label: "Debit GL" },
    { key: "creditGL", label: "Credit GL" },
    { key: "description", label: "Description" },
  ],
  idField: "id",
  searchFields: ["id", "event", "debitGL", "creditGL"],
  apiBase: "/api/db/accounts",
};

export default function AccountingRulesWorkspace() {
  return <CrudWorkspace config={config} />;
}
