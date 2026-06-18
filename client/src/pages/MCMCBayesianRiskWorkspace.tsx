import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { TrendingUp } from "lucide-react";
const config: CrudConfig = {
  domainKey: "mcmc-bayesian-risk", title: "MCMC Bayesian Risk",
  subtitle: "Markov Chain Monte Carlo risk inference: HMC credit scoring, NUTS AML risk, Gibbs fraud clustering with posterior uncertainty quantification.",
  icon: TrendingUp, accentColor: "purple",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "model", label: "Model", type: "select", options: ["HMC-CreditRisk", "NUTS-AMLRisk", "Gibbs-FraudCluster"] },
  ],
  columns: [
    { key: "id", label: "ID", sortable: true }, { key: "customerId", label: "Customer", sortable: true },
    { key: "model", label: "Model", sortable: true }, { key: "posteriorMean", label: "Mean" },
    { key: "posteriorStd", label: "Std Dev" }, { key: "riskGrade", label: "Grade", sortable: true },
  ],
  idField: "id", statusField: "riskGrade", searchFields: ["customerId", "model", "riskGrade"],
  apiBase: "/api/db/anomaly-models",
};
export default function MCMCBayesianRiskWorkspace() { return <CrudWorkspace config={config} />; }
