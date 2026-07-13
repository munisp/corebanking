import { Shield, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATIC_FACTORS = [
  { factor: 'Occupation / Profession', weight: '15%', description: 'High-risk professions (PEPs, lawyers, accountants) receive elevated static scores' },
  { factor: 'Geographic Risk', weight: '20%', description: 'FATF blacklisted countries, high-risk states, border regions — GIABA risk typologies' },
  { factor: 'PEP Status', weight: '25%', description: 'Politically Exposed Persons and associates — 18-month post-office monitoring period' },
  { factor: 'Business Type', weight: '15%', description: 'Cash-intensive businesses, DNFBPs, offshore companies — CBN AML/CFT categorisation' },
  { factor: 'Customer Segment', weight: '10%', description: 'Retail, SME, corporate, non-resident — segment-level base risk score' },
  { factor: 'Onboarding Channel', weight: '15%', description: 'Digital-only vs. branch-verified — remote onboarding attracts higher base score' },
];

const DYNAMIC_FACTORS = [
  { factor: 'Transaction Velocity', weight: '25%', description: 'Rapid fund movement relative to account type — sudden volume spikes trigger rescoring' },
  { factor: 'Alert History', weight: '30%', description: 'Prior STR/SAR flags, false-positive rate, alert closure disposition' },
  { factor: 'Counterparty Risk', weight: '20%', description: 'Network graph analysis — exposure to high-risk senders/receivers' },
  { factor: 'Behavioural Deviation', weight: '15%', description: 'Deviation from customer\'s own historical pattern — ML anomaly detection' },
  { factor: 'Channel Mismatch', weight: '10%', description: 'Unusual channel usage, time-of-day patterns, device anomalies' },
];

const TIERS = [
  { tier: 'Low', range: '0–39', color: 'bg-green-100 text-green-700', review: 'Annual', enhanced: false },
  { tier: 'Medium', range: '40–59', color: 'bg-amber-100 text-amber-700', review: 'Semi-annual', enhanced: false },
  { tier: 'High', range: '60–79', color: 'bg-orange-100 text-orange-700', review: 'Quarterly', enhanced: true },
  { tier: 'Very High', range: '80–100', color: 'bg-red-100 text-red-700', review: 'Monthly', enhanced: true },
];

export default function RiskBasedApproachWorkspace() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-600" />
          Risk-Based Approach Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          ML-powered customer risk scoring — static factors (occupation, geography, PEP status) + dynamic factors (transaction patterns, alert history). Auto-tier assignment.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          The Risk-Based Approach service is in ML training phase. Customer risk scores and tier assignments will be surfaced here once the scoring model is integrated with the transaction monitoring pipeline and customer profile store.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Scored Customers', value: '—' },
          { label: 'High Risk (Tier 3+)', value: '—' },
          { label: 'Pending Review', value: '—' },
          { label: 'Avg Risk Score', value: '—' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Static Risk Factors (50%)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {STATIC_FACTORS.map(f => (
              <div key={f.factor} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{f.factor}</p>
                  <Badge variant="outline" className="text-xs font-mono">{f.weight}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Dynamic Risk Factors (50%)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {DYNAMIC_FACTORS.map(f => (
                <div key={f.factor} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">{f.factor}</p>
                    <Badge variant="outline" className="text-xs font-mono">{f.weight}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Risk Tier Classification</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {TIERS.map(t => (
                <div key={t.tier} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.color}`}>{t.tier}</span>
                    <span className="text-xs text-muted-foreground font-mono">{t.range}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Review: {t.review}</span>
                    {t.enhanced && <Badge variant="destructive" className="text-xs">EDD Required</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
