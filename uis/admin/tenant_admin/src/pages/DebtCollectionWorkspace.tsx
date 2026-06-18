import { DollarSign, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const COLLECTION_STAGES = [
  { stage: 'Early Arrears (1-30 DPD)', action: 'Automated SMS and email reminders via Kafka event trigger', status: 'configured' },
  { stage: 'Soft Collection (31-60 DPD)', action: 'Outbound call campaign assignment, promise-to-pay tracking', status: 'configured' },
  { stage: 'Hard Collection (61-90 DPD)', action: 'Legal notice dispatch, guarantor notification, field visit scheduling', status: 'configured' },
  { stage: 'Non-Performing (90+ DPD)', action: 'IFRS 9 Stage 3 classification, provisioning trigger, litigation referral', status: 'configured' },
  { stage: 'Write-Off / Recovery', action: 'Credit committee approval, debt sale or agency assignment', status: 'planned' },
];

const MIDDLEWARE_INTEGRATIONS = [
  { name: 'Kafka', detail: 'debt-collection.events topic — arrears triggers and payment events' },
  { name: 'Dapr', detail: 'State store: debt-collection-state — collection case management' },
  { name: 'Temporal', detail: 'debt-collection-workflow — automated escalation and follow-up scheduling' },
  { name: 'Postgres', detail: 'debt-collection_config — collection policy rules and agent assignments' },
  { name: 'Keycloak', detail: 'debt-collection-admin role — collection officer access control' },
  { name: 'Permify', detail: 'debt-collection:can_manage — authorization for case actions' },
  { name: 'OpenSearch', detail: 'debt-collection-events index — case history and audit trail' },
  { name: 'TigerBeetle', detail: 'Ledger accounts for recovered amounts and write-offs' },
];

export default function DebtCollectionWorkspace() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-yellow-600" />
          Debt Collection
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Collections workflow, escalation stages, agency assignments and recovery tracking
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          The debt collection service is in configuration phase. Live collection cases and portfolio data will be available once the core lending engine is connected and NPL data flows through the pipeline.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Cases', value: '—' },
          { label: 'Total NPA', value: '—' },
          { label: 'Recovered (MTD)', value: '—' },
          { label: 'Collection Rate', value: '—' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Collection Stages</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {COLLECTION_STAGES.map((s, i) => (
              <div key={s.stage} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.status === 'configured' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {i + 1}
                  </div>
                  {i < COLLECTION_STAGES.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="pb-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm">{s.stage}</p>
                    <Badge variant={s.status === 'configured' ? 'default' : 'outline'} className="text-xs">{s.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.action}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Middleware Integrations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {MIDDLEWARE_INTEGRATIONS.map(m => (
              <div key={m.name} className="border-b pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="secondary" className="text-xs">{m.name}</Badge>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                </div>
                <p className="text-xs text-muted-foreground">{m.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
