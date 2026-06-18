import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function OpenappsecRulesWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "openappsecrules",
        title: "WAF Rules",
        subtitle: "OpenAppSec ML-powered WAF rules — SQL injection, XSS, bot detection, credential stuffing",
        icon: Shield,
        accentColor: "text-emerald-700",
        idField: "id",
        statusField: "severity",
        searchFields: ["id", "name", "category"],
        apiBase: "/api/db/waf-rules",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "mode", label: "Mode", sortable: true },
          { key: "severity", label: "Severity", sortable: true },
          { key: "blockCount24h", label: "Blocked 24h", sortable: true },
          { key: "mlConfidence", label: "ML Score", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
