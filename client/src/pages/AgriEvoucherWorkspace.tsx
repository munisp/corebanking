import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Ticket } from "lucide-react";

const config: CrudConfig = {
  domainKey: "agri-evoucher",
  title: "Agricultural E-Voucher System",
  subtitle: "Digital vouchers for subsidized inputs from NIRSAL and state programs",
  icon: Ticket,
  accentColor: "lime",
  apiBase: "/api/db/agri-evoucher",
  idField: "id",
  statusField: "status",
  searchFields: ["name"],
  fields: [
    { key: "id", label: "ID", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "category", label: "Programme", type: "text" },
    { key: "amount", label: "Value", type: "number" },
    { key: "status", label: "Status", type: "text" }
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "category", label: "Programme" },
    { key: "amount", label: "Value (NGN)" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" }
  ],
};

export default function AgriEvoucherWorkspace() {
  return <CrudWorkspace config={config} />;
}
