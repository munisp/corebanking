import { Receipt } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "self-service-transactions",
  title: "My Transactions",
  subtitle: "Customer transaction history",
  icon: Receipt,
  accentColor: "emerald",
  fields: [{key:"id",label:"Txn ID",type:"readonly"},{key:"description",label:"Description",type:"text"},{key:"amount",label:"Amount",type:"number"},{key:"type",label:"Type",type:"select",options:["credit","debit"]},{key:"channel",label:"Channel",type:"select",options:["pos","nip","mobile","atm","ussd","standing_order","swift","web"]}],
  columns: [{key:"id",label:"ID"},{key:"date",label:"Date"},{key:"description",label:"Description"},{key:"amount",label:"Amount (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`},{key:"type",label:"Type"},{key:"channel",label:"Channel"},{key:"balance",label:"Balance (₦)",render:(v:unknown)=>`₦${(Number(v)||0).toLocaleString()}`}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/transfers",
  pageSize: 25,
};

export default function SelfServiceTransactionsWorkspace() {
  return <CrudWorkspace config={config} />;
}
