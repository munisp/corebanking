import CrudWorkspace from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

export default function JournalEntriesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "journal-entries",
        title: "Journal Entries",
        subtitle: "Double-entry ledger — balanced debit/credit journal postings with audit trail",
        icon: FileText,
        accentColor: "text-indigo-700",
        idField: "id",
        statusField: "status",
        searchFields: ["id", "description", "reference"],
        apiBase: "/api/db/journal-entries",
        pageSize: 25,
        columns: [
          { key: "id", label: "Entry ID", sortable: true },
          { key: "date", label: "Date", sortable: true },
          { key: "description", label: "Description", sortable: true },
          { key: "reference", label: "Reference" },
          { key: "postedBy", label: "Posted By" },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "description", label: "Description", type: "text", required: true },
          { key: "reference", label: "Reference", type: "text", required: true },
          { key: "date", label: "Date", type: "text", required: true },
        ],
      }}
    />
  );
}
