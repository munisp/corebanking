import { FileBarChart } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "statements-history",
  title: "Statement History",
  subtitle: "Account statement generation and delivery",
  icon: FileBarChart,
  accentColor: "teal",
  fields: [{key:"id",label:"Statement ID",type:"text"},{key:"accountId",label:"Account ID",type:"text"},{key:"format",label:"Format",type:"select",options:["pdf","csv","mt940","excel","tax_certificate"]},{key:"status",label:"Status",type:"select",options:["processing","delivered","failed"]}],
  columns: [{key:"id",label:"ID"},{key:"accountId",label:"Account"},{key:"format",label:"Format"},{key:"period",label:"Period"},{key:"status",label:"Status"},{key:"deliveryChannel",label:"Channel"},{key:"generatedAt",label:"Generated"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/customer-statements",
  pageSize: 25,
};

export default function StatementHistoryWorkspace() {
  return <CrudWorkspace config={config} />;
}
