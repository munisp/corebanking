import { TrendingUp } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "islamic-wakala",
  title: "Wakala Investments",
  subtitle: "Islamic agent-based investments",
  icon: TrendingUp,
  accentColor: "blue",
  fields: [{key:"id",label:"Investment ID",type:"text"},{key:"investor",label:"Investor",type:"text"},{key:"agent",label:"Agent",type:"text"},{key:"principal",label:"Principal",type:"number"},{key:"wakalaFee",label:"Wakala Fee %",type:"number"},{key:"status",label:"Status",type:"select",options:["active","pending","completed"]}],
  columns: [{key:"id",label:"ID"},{key:"investor",label:"Investor"},{key:"agent",label:"Agent"},{key:"principal",label:"Principal (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`},{key:"wakalaFee",label:"Fee %"},{key:"expectedReturn",label:"Expected %"},{key:"actualReturn",label:"Actual %"},{key:"status",label:"Status"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function WakalaInvestmentWorkspace() {
  return <CrudWorkspace config={config} />;
}
