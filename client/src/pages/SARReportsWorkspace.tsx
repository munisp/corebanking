import { FileText } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "kyc-sar-reports",
  title: "SAR Reports",
  subtitle: "Suspicious activity reports",
  icon: FileText,
  accentColor: "red",
  fields: [{key:"id",label:"SAR ID",type:"text"},{key:"customerName",label:"Customer",type:"text"},{key:"reason",label:"Reason",type:"textarea"},{key:"amount",label:"Amount",type:"number"},{key:"status",label:"Status",type:"select",options:["filed","under_review","escalated","closed"]}],
  columns: [{key:"id",label:"ID"},{key:"customerName",label:"Customer"},{key:"reason",label:"Reason"},{key:"amount",label:"Amount (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`},{key:"filedDate",label:"Filed"},{key:"status",label:"Status"},{key:"cbnReference",label:"CBN Ref"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function SARReportsWorkspace() {
  return <CrudWorkspace config={config} />;
}
