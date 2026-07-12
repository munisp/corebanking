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
        idField: "employee_id",
        statusField: "status",
        searchFields: ["employee_number", "first_name", "last_name", "email", "role", "department"],
        apiBase: "/employee/employees",
        responseKey: "employees",
        pageSize: 25,
        columns: [
          { key: "employee_number", label: "Emp No." },
          { key: "first_name", label: "First Name", sortable: true },
          { key: "last_name", label: "Last Name", sortable: true },
          { key: "email", label: "Email", sortable: true },
          { key: "role", label: "Role", sortable: true },
          { key: "department", label: "Department", sortable: true },
          { key: "branch_id", label: "Branch", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [
          {
            key: "employee_number",
            label: "Employee Number",
            type: "text",
            required: true,
            placeholder: "e.g. EMP-001",
          },
          {
            key: "first_name",
            label: "First Name",
            type: "text",
            required: true,
            placeholder: "First name",
          },
          {
            key: "last_name",
            label: "Last Name",
            type: "text",
            required: true,
            placeholder: "Last name",
          },
          {
            key: "email",
            label: "Email",
            type: "text",
            required: true,
            placeholder: "staff@bank.com",
          },
          {
            key: "phone",
            label: "Phone",
            type: "text",
            placeholder: "+234 800 000 0000",
          },
          {
            key: "role",
            label: "Role",
            type: "select",
            required: true,
            options: ["teller", "loan_officer", "branch_manager", "bank_admin", "compliance", "auditor"],
            defaultValue: "teller",
          },
          {
            key: "department",
            label: "Department",
            type: "text",
            required: true,
            placeholder: "e.g. Retail Banking",
          },
          {
            key: "branch",
            label: "Branch ID",
            type: "text",
            required: true,
            placeholder: "Branch identifier",
          },
          {
            key: "hire_date",
            label: "Hire Date",
            type: "date",
          },
        ],
        actions: [
          { label: "View Profile", key: "details" },
          { label: "Reset Password", key: "reset-password" },
          { label: "Deactivate", key: "deactivate", variant: "destructive", condition: (r) => r.status === "active" },
        ],
      }}
    />
  );
}
