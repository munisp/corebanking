import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ShieldAlert, Search, ChevronRight, Calculator } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useRiskAssessmentList, useRiskPortfolio, useScoreEntity } from '../hooks/useRiskScoring';
import type { RiskAssessment, ScoreEntityPayload, ScoreEntityResult } from '../types/riskScoring';

const fmtB = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

const RATING_COLOR: Record<string, string> = {
  AA: 'bg-green-100 text-green-700', 'A+': 'bg-green-100 text-green-700', A: 'bg-green-100 text-green-700',
  'BBB+': 'bg-blue-100 text-blue-700', BBB: 'bg-blue-100 text-blue-700', BB: 'bg-amber-100 text-amber-700',
  B: 'bg-orange-100 text-orange-700', 'B-': 'bg-orange-100 text-orange-700',
  CCC: 'bg-red-100 text-red-700', 'N/A': 'bg-gray-100 text-gray-500',
};

const STAGE_CFG: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  0: { label: 'N/A', variant: 'outline' },
  1: { label: 'Stage 1', variant: 'default' },
  2: { label: 'Stage 2', variant: 'secondary' },
  3: { label: 'Stage 3', variant: 'destructive' },
};

const SECTORS = ['oil_gas', 'construction', 'agriculture', 'manufacturing', 'financial_services', 'technology', 'retail_consumer', 'other'];

function ScoreEntityForm() {
  const { mutate: score, isPending, data: result } = useScoreEntity();
  const { register, handleSubmit, formState: { errors } } = useForm<ScoreEntityPayload>({
    defaultValues: { days_past_due: 0, years_in_business: 0, sector: 'manufacturing' },
  });

  function onSubmit(data: ScoreEntityPayload) { score(data); }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="w-4 h-4" /> Score Entity</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Entity ID <span className="text-destructive">*</span></Label>
                <Input {...register('entity_id', { required: true })} placeholder="CUST-001" />
                {errors.entity_id && <p className="text-xs text-destructive">Required</p>}
              </div>
              <div className="space-y-1">
                <Label>Entity Name <span className="text-destructive">*</span></Label>
                <Input {...register('entity_name', { required: true })} placeholder="Company or person name" />
                {errors.entity_name && <p className="text-xs text-destructive">Required</p>}
              </div>
              <div className="space-y-1">
                <Label>Exposure (₦) <span className="text-destructive">*</span></Label>
                <Input type="number" {...register('exposure', { required: true, min: 1, valueAsNumber: true })} />
                {errors.exposure && <p className="text-xs text-destructive">Required and must be positive</p>}
              </div>
              <div className="space-y-1">
                <Label>Collateral Value (₦)</Label>
                <Input type="number" {...register('collateral_value', { min: 0, valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Days Past Due</Label>
                <Input type="number" {...register('days_past_due', { min: 0, valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Annual Revenue (₦)</Label>
                <Input type="number" {...register('annual_revenue', { min: 0, valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Years in Business</Label>
                <Input type="number" {...register('years_in_business', { min: 0, valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Sector</Label>
                <Input {...register('sector')} list="sectors-list" />
                <datalist id="sectors-list">
                  {SECTORS.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Scoring…' : 'Compute Risk Score'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Score Result</CardTitle></CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Enter entity details and click Compute Risk Score</p>
          ) : (
            <ScoreResult result={result} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreResult({ result }: { result: ScoreEntityResult }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold px-3 py-1 rounded ${RATING_COLOR[result.rating] ?? 'bg-gray-100 text-gray-700'}`}>{result.rating}</span>
        <span className="text-muted-foreground">{result.entityName}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ['PD', `${result.pd}%`],
          ['LGD', `${result.lgd}%`],
          ['EAD', fmtB(result.ead)],
          ['Expected Loss', fmtB(result.expectedLoss)],
          ['Risk Weight', `${result.riskWeight}%`],
          ['RWA', fmtB(result.rwa)],
          ['IFRS9 Stage', `Stage ${result.ifrs9Stage}`],
          ['Collateral Coverage', `${result.collateralCoverage}%`],
        ].map(([k, v]) => (
          <div key={k} className="bg-muted/30 rounded p-2">
            <p className="text-muted-foreground text-xs">{k}</p>
            <p className="font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">Sector: <span className="font-medium capitalize">{result.sector.replace(/_/g, ' ')}</span></div>
    </div>
  );
}

function AssessmentDetailSheet({ assessment, open, onClose }: { assessment: RiskAssessment | null; open: boolean; onClose: () => void }) {
  if (!assessment) return null;
  const stageCfg = STAGE_CFG[assessment.ifrs9_stage] ?? STAGE_CFG[1];
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[440px] sm:max-w-[440px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            {assessment.id}
          </SheetTitle>
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${RATING_COLOR[assessment.rating] ?? 'bg-gray-100'}`}>{assessment.rating}</span>
            <Badge variant={stageCfg.variant}>{stageCfg.label}</Badge>
          </div>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {[
            ['Entity', assessment.entity_name],
            ['Entity ID', assessment.entity_id],
            ['Entity Type', assessment.entity_type.replace(/_/g, ' ')],
            ['Risk Type', assessment.risk_type],
            ['PD', `${assessment.pd}%`],
            ['LGD', `${assessment.lgd}%`],
            ['EAD', fmtB(assessment.ead)],
            ['Expected Loss', fmtB(assessment.expected_loss)],
            ['Risk Weight', `${assessment.risk_weight}%`],
            ['RWA', fmtB(assessment.rwa)],
            ['Assessment Date', assessment.assessment_date],
            ['Next Review', assessment.next_review],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0 capitalize">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function RiskScoringWorkspace() {
  const { data: listData, isLoading } = useRiskAssessmentList();
  const { data: portfolio } = useRiskPortfolio();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RiskAssessment | null>(null);

  const items = listData?.items ?? [];
  const filtered = items.filter(a =>
    !search || [a.id, a.entity_name, a.entity_id, a.rating, a.risk_type].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-600" />
          Risk Scoring
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          PD/LGD/EAD assessments, Basel III RWA, IFRS 9 staging and on-demand entity scoring
        </p>
      </div>

      {portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Assessments', value: portfolio.totalAssessments },
            { label: 'Total EAD', value: fmtB(portfolio.totalEAD) },
            { label: 'Total RWA', value: fmtB(portfolio.totalRWA) },
            { label: 'Total Expected Loss', value: fmtB(portfolio.totalExpectedLoss) },
          ].map(c => (
            <Card key={c.label}><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold mt-1">{String(c.value)}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      {portfolio?.countByIFRS9Stage && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(portfolio.countByIFRS9Stage).map(([stage, count]) => {
            const cfg = STAGE_CFG[Number(stage)] ?? STAGE_CFG[1];
            return <Badge key={stage} variant={cfg.variant}>{cfg.label}: {count}</Badge>;
          })}
        </div>
      )}

      <Tabs defaultValue="assessments">
        <TabsList>
          <TabsTrigger value="assessments">Risk Assessments</TabsTrigger>
          <TabsTrigger value="score" className="gap-2"><Calculator className="w-4 h-4" /> Score Entity</TabsTrigger>
        </TabsList>

        <TabsContent value="assessments" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Assessment Register</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search entity, rating, type…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="text-right">PD%</TableHead>
                      <TableHead className="text-right">LGD%</TableHead>
                      <TableHead className="text-right">EAD</TableHead>
                      <TableHead className="text-right">Expected Loss</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No assessments found</TableCell></TableRow>}
                    {filtered.map(a => {
                      const stageCfg = STAGE_CFG[a.ifrs9_stage] ?? STAGE_CFG[1];
                      return (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(a)}>
                          <TableCell className="font-mono text-xs font-medium">{a.id}</TableCell>
                          <TableCell className="font-medium text-sm max-w-[160px] truncate">{a.entity_name}</TableCell>
                          <TableCell className="text-xs capitalize">{a.risk_type}</TableCell>
                          <TableCell><span className={`text-xs font-bold px-2 py-0.5 rounded ${RATING_COLOR[a.rating] ?? 'bg-gray-100'}`}>{a.rating}</span></TableCell>
                          <TableCell className="text-right text-sm">{a.pd}</TableCell>
                          <TableCell className="text-right text-sm">{a.lgd}</TableCell>
                          <TableCell className="text-right text-sm">{fmtB(a.ead)}</TableCell>
                          <TableCell className="text-right font-bold">{fmtB(a.expected_loss)}</TableCell>
                          <TableCell><Badge variant={stageCfg.variant}>{stageCfg.label}</Badge></TableCell>
                          <TableCell className="text-xs capitalize">{a.status.replace(/_/g, ' ')}</TableCell>
                          <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="score" className="mt-4"><ScoreEntityForm /></TabsContent>
      </Tabs>

      <AssessmentDetailSheet assessment={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
