import { AlertTriangle } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "exam-management",
  title: "Regulatory Exam Tracking",
  subtitle: "CBN/NDIC examination findings, remediation tracking, compliance evidence management",
  icon: AlertTriangle,
  accentColor: "yellow",
  fields: [
    { key: "id", label: "Finding ID", type: "readonly" },
    { key: "category", label: "Category", type: "readonly" },
    { key: "severity", label: "Severity", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "Finding ID" },
    { key: "examId", label: "Exam" },
    { key: "regulator", label: "Regulator" },
    { key: "category", label: "Category" },
    { key: "severity", label: "Severity" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
    { key: "dueDate", label: "Due Date" },
  ],
  idField: "id",
  searchFields: ["id", "category", "severity", "regulator"],
  apiBase: "/api/db/accounts",
};

export default function ExamManagementWorkspace() {
  return <CrudWorkspace config={config} />;
}
