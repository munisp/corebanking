import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";
const config: CrudConfig = {
  domainKey: "art-adversarial", title: "ART Adversarial Robustness",
  subtitle: "IBM Adversarial Robustness Toolbox: evasion/poisoning/extraction defense for fraud and AML ML models. Certified robustness for CBN compliance.",
  icon: Shield, accentColor: "slate",
  fields: [
    { key: "model", label: "Model", type: "text", required: true },
    { key: "surface", label: "Attack Surface", type: "select", options: ["evasion", "graph_evasion", "data_poisoning", "extraction"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "model", label: "Model", sortable: true },
    { key: "surface", label: "Attack Surface" }, { key: "robustness", label: "Robustness" },
    { key: "cleanAcc", label: "Clean Acc" }, { key: "advAcc", label: "Adv Acc" },
  ],
  idField: "id", searchFields: ["model", "surface"],
  apiBase: "/api/db/anomaly-models",
};
export default function ARTAdversarialWorkspace() { return <CrudWorkspace config={config} />; }
