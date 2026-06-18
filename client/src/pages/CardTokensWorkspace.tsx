import { Smartphone } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "cards-tokens",
  title: "Card Tokens",
  subtitle: "Digital wallet tokenization management",
  icon: Smartphone,
  accentColor: "indigo",
  fields: [{key:"id",label:"Token ID",type:"text"},{key:"cardId",label:"Card ID",type:"text"},{key:"walletProvider",label:"Provider",type:"select",options:["apple_pay","google_pay","samsung_pay"]},{key:"status",label:"Status",type:"select",options:["active","suspended","deleted"]}],
  columns: [{key:"id",label:"Token ID"},{key:"cardId",label:"Card"},{key:"walletProvider",label:"Wallet"},{key:"tokenType",label:"Type"},{key:"deviceId",label:"Device"},{key:"status",label:"Status"},{key:"lastUsed",label:"Last Used"}],
  idField: "id",
  searchFields: ["id", "name"],
  apiBase: "/api/db/accounts",
  pageSize: 25,
};

export default function CardTokensWorkspace() {
  return <CrudWorkspace config={config} />;
}
