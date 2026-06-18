import { AlertTriangle } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "kyc-watchlist",
  title: "Watchlist Screening",
  subtitle: "KYC/AML watchlist and sanctions",
  icon: AlertTriangle,
  accentColor: "red",
  fields: [{key:"id",label:"Entry ID",type:"text"},{key:"name",label:"Name",type:"text"},{key:"type",label:"Type",type:"select",options:["individual","entity"]},{key:"source",label:"Source",type:"text"},{key:"riskLevel",label:"Risk",type:"select",options:["critical","high","medium","low"]}],
  columns: [{key:"id",label:"ID"},{key:"name",label:"Name"},{key:"type",label:"Type"},{key:"source",label:"Source"},{key:"addedDate",label:"Added"},{key:"riskLevel",label:"Risk Level"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/watchlist-sources",
  pageSize: 25,
};

export default function WatchlistWorkspace() {
  return <CrudWorkspace config={config} />;
}
