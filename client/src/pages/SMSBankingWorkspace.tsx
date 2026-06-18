import CrudWorkspace from "@/components/CrudWorkspace";
import { MessageSquare } from "lucide-react";

export default function SMSBankingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "sms-banking",
        title: "SMS Banking",
        subtitle: "SMS commands, syntax reference, PIN-secured banking via shortcode 54545",
        icon: MessageSquare,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "requiresPin",
        searchFields: ["command", "description"],
        apiBase: "/api/db/sms-banking-gateway",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "command", label: "Command", sortable: true },
          { key: "syntax", label: "Syntax" },
          { key: "example", label: "Example" },
          { key: "description", label: "Description", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
