import { Gauge, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LIMIT_TYPES = [
  { name: 'Single Obligor Limit', description: 'Maximum exposure to any single borrower — CBN regulatory cap at 20% of shareholders\' funds', status: 'enforced' },
  { name: 'Sector Concentration Limit', description: 'Portfolio ceiling per sector (oil & gas, construction, agriculture, etc.) per ICAAP guidelines', status: 'enforced' },
  { name: 'Large Exposure Limit', description: 'Aggregate exposures ≥ 10% of eligible capital base — Basel III large exposure framework', status: 'enforced' },
  { name: 'Country / Cross-Border Limit', description: 'Maximum exposure to non-Nigerian counterparties and foreign currency obligations', status: 'planned' },
  { name: 'Interbank Placement Limit', description: 'Per-counterparty ceiling for overnight and term money market placements', status: 'planned' },
  { name: 'Product-Level Limit', description: 'Facility-type caps (overdraft, LC, BG, trade finance) across the loan book', status: 'planned' },
  { name: 'Sub-Facility / Tranche Limit', description: 'Individual tranche ceiling within a revolving credit facility', status: 'planned' },
];

const GOVERNANCE = [
  { committee: 'Board Credit Committee (BCC)', frequency: 'Monthly', responsibility: 'Approve limits above ₦5B, sectoral concentration policy' },
  { committee: 'Management Credit Committee (MCC)', frequency: 'Weekly', responsibility: 'Approve limits ₦500M–₦5B, monitor utilization breaches' },
  { committee: 'Credit Risk Function', frequency: 'Daily', responsibility: 'Real-time limit monitoring, breach alerts, utilization reporting' },
  { committee: 'Treasury ALCO', frequency: 'Monthly', responsibility: 'Interbank, FX and liquidity limit review' },
];

export default function LimitManagementWorkspace() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gauge className="w-6 h-6 text-indigo-600" />
          Limit Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Single obligor, sector concentration, large exposure and interbank placement limit controls
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Limit management is governed by the Credit Facility service. Real-time utilization monitoring and breach alerts will be surfaced here once the limit enforcement engine is fully integrated with the TigerBeetle ledger and Kafka event stream.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Limits', value: '—' },
          { label: 'Breached', value: '—' },
          { label: 'Near Breach (>85%)', value: '—' },
          { label: 'Largest Exposure', value: '—' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Limit Framework</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {LIMIT_TYPES.map(l => (
              <div key={l.name} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{l.name}</p>
                  <Badge variant={l.status === 'enforced' ? 'default' : 'outline'} className="text-xs capitalize">{l.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{l.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Credit Governance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {GOVERNANCE.map(g => (
              <div key={g.committee} className="border-b pb-3 last:border-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{g.committee}</p>
                  <Badge variant="secondary" className="text-xs">{g.frequency}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{g.responsibility}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
