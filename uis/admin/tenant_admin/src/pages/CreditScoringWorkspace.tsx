import { TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SCORING_MODELS = [
  { name: 'PD/LGD/EAD Model', status: 'planned', description: 'Probability of default, loss given default, and exposure at default calculation using Basel III framework' },
  { name: 'IFRS 9 ECL Engine', status: 'planned', description: 'Expected credit loss staging (Stage 1/2/3) with 12-month and lifetime ECL computation' },
  { name: 'Behavioral Scorecard', status: 'planned', description: 'Transaction pattern analysis, repayment history, product cross-holding and account vintage scoring' },
  { name: 'Application Scorecard', status: 'planned', description: 'Demographic, employment, income and BVN-linked bureau data scoring at origination' },
  { name: 'SME Credit Score', status: 'planned', description: 'Business financial ratios, cash flow volatility, sector concentration and management quality scoring' },
  { name: 'Agricultural Risk Score', status: 'planned', description: 'Crop yield forecasting, weather risk integration, NIRSAL guarantee alignment and cooperative credit history' },
];

const DATA_SOURCES = [
  { source: 'Credit Bureau (CRC / FirstCentral / CreditRegistry)', purpose: 'Historical credit behaviour, facility records, DPD history' },
  { source: 'BVN Registry (NIBSS)', purpose: 'Identity verification, account linkage, fraud detection' },
  { source: 'Core Banking System', purpose: 'Account balance, transaction velocity, product portfolio' },
  { source: 'NIBSS eMandates / e-BillsPay', purpose: 'Repayment behaviour via mandate standing data' },
  { source: 'NBS Agricultural Statistics', purpose: 'Commodity price indices, regional yield data' },
  { source: 'NIRSAL / AGSMEIS', purpose: 'Guarantee status, cooperative credit history' },
];

export default function CreditScoringWorkspace() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-red-600" />
          Credit Scoring
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          ML-powered credit risk scoring engine for retail, SME and agricultural customers
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          The credit scoring service is in integration phase. Model training pipelines and scoring endpoints will be available once the ML infrastructure is fully connected. The framework below reflects the planned scoring architecture.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Scoring Models', value: '—' },
          { label: 'Scored Today', value: '—' },
          { label: 'Avg Score', value: '—' },
          { label: 'Model Accuracy', value: '—' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Scoring Models</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {SCORING_MODELS.map(m => (
              <div key={m.name} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{m.name}</p>
                  <Badge variant="outline" className="text-xs capitalize">{m.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Data Sources</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {DATA_SOURCES.map(d => (
              <div key={d.source} className="border-b pb-2 last:border-0 last:pb-0 text-sm">
                <p className="font-medium">{d.source}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.purpose}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
