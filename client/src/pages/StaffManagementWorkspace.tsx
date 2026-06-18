import CrudWorkspace from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

export default function StaffManagementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "staff-management",
        title: "Staff Management",
        subtitle: "Employees, roles, permissions, branches — dual control and MFA enforcement",
        icon: Users,
        accentColor: "text-teal-700",
        idField: "id",
        statusField: "status",
        searchFields: ["fullName", "employeeId", "role", "department", "branch"],
        apiBase: "/api/db/customers",
        pageSize: 25,
        columns: [
          { key: "employeeId", label: "Emp ID" },
          { key: "fullName", label: "Name", sortable: true },
          { key: "role", label: "Role", sortable: true },
          { key: "department", label: "Department", sortable: true },
          { key: "branch", label: "Branch", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "mfaEnabled", label: "MFA", render: (v) => v ? "Enabled" : "Disabled" },
          { key: "lastLogin", label: "Last Login", sortable: true },
        ],
        fields: [
          { key: "fullName", label: "Full Name", type: "text", required: true },
          { key: "email", label: "Email", type: "text", required: true },
          { key: "role", label: "Role", type: "text", required: true },
          { key: "department", label: "Department", type: "text", required: true },
          { key: "branch", label: "Branch", type: "text", required: true },
        ],
      }}
    />
  );
}
