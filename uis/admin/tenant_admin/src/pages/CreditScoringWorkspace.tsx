import { useState } from 'react';
import { TrendingUp, Info, Loader2, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { creditAdvisoryApi, type CreditAdvisoryResult } from '@/api/creditRiskApi';

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

/**
 * W12 A4-P1-A — live advisory scoring against credit-scoring-py:
 * POST /api/v1/score/advisory and POST /api/v1/affordability/advisory
 * (previously orphaned; services/credit-scoring-py/main.py:475,486).
 */
function AdvisoryScoringSection() {
  const [scoreForm, setScoreForm] = useState({ income: '', debt: '', employment_years: '', loan_history_count: '', defaults: '0', age: '' });
  const [affForm, setAffForm] = useState({ monthly_income: '', monthly_expenses: '', proposed_emi: '' });
  const [scoreResult, setScoreResult] = useState<CreditAdvisoryResult | null>(null);
  const [affResult, setAffResult] = useState<CreditAdvisoryResult | null>(null);
  const [loans, setLoans] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loadLoans() {
    setBusy('loans');
    try {
      setLoans(await creditAdvisoryApi.listLoans());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load loans');
    } finally {
      setBusy(null);
    }
  }

  const scoreReady = ['income', 'debt', 'employment_years', 'loan_history_count', 'defaults', 'age']
    .every((k) => scoreForm[k as keyof typeof scoreForm] !== '');
  const affReady = affForm.monthly_income !== '' && affForm.monthly_expenses !== '' && affForm.proposed_emi !== '';

  async function runScore() {
    setBusy('score');
    setScoreResult(null);
    try {
      const res = await creditAdvisoryApi.scoreAdvisory({
        income: Number(scoreForm.income),
        debt: Number(scoreForm.debt),
        employment_years: Number(scoreForm.employment_years),
        loan_history_count: Number(scoreForm.loan_history_count),
        defaults: Number(scoreForm.defaults),
        age: Number(scoreForm.age),
      });
      setScoreResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Advisory scoring failed');
    } finally {
      setBusy(null);
    }
  }

  async function runAffordability() {
    setBusy('affordability');
    setAffResult(null);
    try {
      const res = await creditAdvisoryApi.affordabilityAdvisory({
        monthly_income: Number(affForm.monthly_income),
        monthly_expenses: Number(affForm.monthly_expenses),
        proposed_emi: Number(affForm.proposed_emi),
      });
      setAffResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Affordability check failed');
    } finally {
      setBusy(null);
    }
  }

  const numInput = (value: string, onChange: (v: string) => void, placeholder?: string) => (
    <Input type="number" min="0" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Advisory Credit Score (live)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Annual income (₦)</Label>{numInput(scoreForm.income, (v) => setScoreForm((f) => ({ ...f, income: v })))}</div>
            <div className="space-y-1"><Label className="text-xs">Total debt (₦)</Label>{numInput(scoreForm.debt, (v) => setScoreForm((f) => ({ ...f, debt: v })))}</div>
            <div className="space-y-1"><Label className="text-xs">Employment years</Label>{numInput(scoreForm.employment_years, (v) => setScoreForm((f) => ({ ...f, employment_years: v })))}</div>
            <div className="space-y-1"><Label className="text-xs">Loan history count</Label>{numInput(scoreForm.loan_history_count, (v) => setScoreForm((f) => ({ ...f, loan_history_count: v })))}</div>
            <div className="space-y-1"><Label className="text-xs">Defaults</Label>{numInput(scoreForm.defaults, (v) => setScoreForm((f) => ({ ...f, defaults: v })))}</div>
            <div className="space-y-1"><Label className="text-xs">Age</Label>{numInput(scoreForm.age, (v) => setScoreForm((f) => ({ ...f, age: v })))}</div>
          </div>
          <Button size="sm" disabled={!scoreReady || busy !== null} onClick={() => void runScore()}>
            {busy === 'score' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
            Compute advisory score
          </Button>
          {scoreResult && (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(scoreResult, null, 2)}</pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Affordability Advisory (live)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Monthly income (₦)</Label>{numInput(affForm.monthly_income, (v) => setAffForm((f) => ({ ...f, monthly_income: v })))}</div>
            <div className="space-y-1"><Label className="text-xs">Monthly expenses (₦)</Label>{numInput(affForm.monthly_expenses, (v) => setAffForm((f) => ({ ...f, monthly_expenses: v })))}</div>
            <div className="space-y-1"><Label className="text-xs">Proposed EMI (₦)</Label>{numInput(affForm.proposed_emi, (v) => setAffForm((f) => ({ ...f, proposed_emi: v })))}</div>
          </div>
          <Button size="sm" disabled={!affReady || busy !== null} onClick={() => void runAffordability()}>
            {busy === 'affordability' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
            Check affordability
          </Button>
          {affResult && (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(affResult, null, 2)}</pre>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Loan Book (credit-scoring-py /api/v1/loans)</CardTitle>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void loadLoans()}>
            {busy === 'loans' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Load loans
          </Button>
        </CardHeader>
        <CardContent>
          {loans === null ? (
            <p className="text-sm text-muted-foreground">Press "Load loans" to query the scoring service loan book.</p>
          ) : (
            <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(loans, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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

      <AdvisoryScoringSection />

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
