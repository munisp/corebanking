import { Users, TrendingUp, AlertCircle, DollarSign, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const POLICY_ITEMS = [
  { label: 'Group Size', value: '5–30 members' },
  { label: 'Guarantee Model', value: 'Joint-liability (peer guarantee)' },
  { label: 'Max Loan per Member', value: '₦5,000,000' },
  { label: 'Repayment Frequency', value: 'Weekly / Bi-weekly' },
  { label: 'Interest Rate', value: '3–5% flat per annum' },
  { label: 'Meeting Cadence', value: 'Weekly group meeting required' },
  { label: 'Collateral', value: 'None (peer guarantee replaces collateral)' },
  { label: 'Default Handling', value: 'Group responsible; credit bureau reporting' },
];

const PIPELINE = [
  { step: 'Group Formation', desc: 'Minimum 5 members with valid BVN', status: 'ready' },
  { step: 'KYC Verification', desc: 'All members cleared via NIBSS/CRC', status: 'ready' },
  { step: 'Group Training', desc: 'Financial literacy orientation session', status: 'ready' },
  { step: 'Loan Application', desc: 'Collective loan request submitted', status: 'pending' },
  { step: 'Credit Assessment', desc: 'Group scoring and risk rating', status: 'pending' },
  { step: 'Approval & Disbursement', desc: 'CBN-compliant disbursement to each member', status: 'pending' },
];

export default function GroupLending() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-violet-600" />
          Group Lending
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Joint-liability microfinance, cooperative credit groups, and peer-guarantee lending
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          The group lending service is currently in integration phase. Live group data will be available once the core lending engine is fully connected. The UI below reflects configured policy and operational workflow.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Groups', value: '—', icon: Users, color: 'text-blue-600' },
          { label: 'Total Disbursed', value: '—', icon: DollarSign, color: 'text-green-600' },
          { label: 'Avg Repayment Rate', value: '—', icon: TrendingUp, color: 'text-violet-600' },
          { label: 'Default Rate', value: '—', icon: AlertCircle, color: 'text-red-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold mt-0.5">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Lending Policy</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {POLICY_ITEMS.map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start text-sm border-b pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[55%]">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Loan Origination Pipeline</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PIPELINE.map(({ step, desc, status }, i) => (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${status === 'ready' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {i + 1}
                    </div>
                    {i < PIPELINE.length - 1 && <div className="w-0.5 h-full bg-gray-200 mt-1" />}
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{step}</p>
                      <Badge variant={status === 'ready' ? 'default' : 'outline'} className="text-xs">
                        {status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
