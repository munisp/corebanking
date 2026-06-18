import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldCheck } from "lucide-react";
const config: CrudConfig = {
  domainKey: "continuous-liveness", title: "Continuous Liveness & Step-Up Auth",
  subtitle: "Step-up re-verification on high-value transfers, behavioral biometrics baseline, device binding, periodic Tier 3 quarterly re-verify.",
  icon: ShieldCheck, accentColor: "lime",
  fields: [
    { key: "trigger", label: "Trigger", type: "select", options: ["high_value_transfer", "international_transfer", "new_beneficiary_large", "periodic_tier3_quarterly"] },
  ],
  columns: [
    { key: "trigger", label: "Trigger", sortable: true }, { key: "threshold", label: "Threshold (₦)" },
    { key: "methods", label: "Methods" },
  ],
  idField: "trigger", searchFields: ["trigger"],
  apiBase: "/continuous-liveness/v1/sessions",
};
export default function ContinuousLivenessWorkspace() { return <CrudWorkspace config={config} />; }
