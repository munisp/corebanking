import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FileSearch, Search, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useCreditReports, useCreditFacilityRecords, useCreditBureauStats, useScoreCheck } from '../hooks/useCreditBureau';
import type { CreditReport, ScoreCheckPayload } from '../types/creditBureau';

const fmt = (n: number) => `₦${n.toLocaleString()}`;

const SCORE_BAND_COLOR: Record<string, string> = {
  Excellent: 'bg-green-100 text-green-700',
  Good: 'bg-blue-100 text-blue-700',
  Fair: 'bg-amber-100 text-amber-700',
  Poor: 'bg-red-100 text-red-700',
};

const STATUS_CFG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  current: { label: 'Current', variant: 'default' },
  watch_list: { label: 'Watch List', variant: 'secondary' },
  non_performing: { label: 'Non-Performing', variant: 'destructive' },
};

const CLASSIFICATION_COLOR: Record<string, string> = {
  performing: 'bg-green-100 text-green-700',
  sub_standard: 'bg-amber-100 text-amber-700',
  doubtful: 'bg-orange-100 text-orange-700',
  lost: 'bg-red-100 text-red-700',
};

const REC_COLOR: Record<string, string> = {
  APPROVE: 'text-green-700 font-bold',
  REFER: 'text-amber-700 font-bold',
  DECLINE: 'text-red-700 font-bold',
};

function ScoreCheckDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: check, isPending, data: result, reset } = useScoreCheck();
  const { register, handleSubmit, formState: { errors } } = useForm<ScoreCheckPayload>();

  function onSubmit(data: ScoreCheckPayload) { check(data); }
  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSearch className="w-4 h-4" /> Credit Score Check</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>BVN <span className="text-destructive">*</span></Label>
            <Input {...register('bvn', { required: true, minLength: 11, maxLength: 11 })} placeholder="11-digit BVN" maxLength={11} />
            {errors.bvn && <p className="text-xs text-destructive">BVN must be exactly 11 digits</p>}
          </div>
          <div className="space-y-1">
            <Label>Customer Name <span className="text-destructive">*</span></Label>
            <Input {...register('customer_name', { required: true })} placeholder="Full name" />
            {errors.customer_name && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Bureau</Label>
            <Input {...register('bureau')} placeholder="CRC, FirstCentral, CreditRegistry…" />
          </div>

          {result && (
            <div className={`p-4 rounded-lg border text-sm space-y-2 ${result.found ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className="font-semibold">Bureau: {result.bureau}</p>
              {result.found ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Credit Score', String(result.creditScore ?? '—')],
                      ['Score Band', result.scoreBand ?? '—'],
                      ['Total Outstanding', fmt(result.totalOutstanding ?? 0)],
                      ['Total Overdue', fmt(result.totalOverdue ?? 0)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-muted-foreground text-xs">{k}</p>
                        <p className="font-medium">{v}</p>
                      </div>
                    ))}
                  </div>
                  <p>Recommendation: <span className={REC_COLOR[result.recommendation] ?? ''}>{result.recommendation}</span></p>
                </>
              ) : (
                <p className="text-muted-foreground">{result.message ?? 'No credit history found'}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Close</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Checking…' : 'Check Score'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportDetailSheet({ report, open, onClose }: { report: CreditReport | null; open: boolean; onClose: () => void }) {
  if (!report) return null;
  const cfg = STATUS_CFG[report.status] ?? STATUS_CFG.current;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[460px] sm:max-w-[460px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-blue-600" />
            {report.customer_name}
          </SheetTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${SCORE_BAND_COLOR[report.score_band] ?? 'bg-gray-100 text-gray-700'}`}>{report.score_band}</span>
          </div>
        </SheetHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              ['Report ID', report.id],
              ['Bureau', report.bureau],
              ['BVN', report.bvn],
              ['Credit Score', String(report.credit_score)],
              ['Total Facilities', String(report.total_facilities)],
              ['Active Facilities', String(report.active_facilities)],
              ['Max DPD', `${report.max_days_past_due} days`],
              ['Enquiries (6m)', String(report.enquiry_count_6m)],
              ['Report Date', report.report_date],
              ['Next Refresh', report.next_refresh],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-muted-foreground text-xs">{k}</p>
                <p className="font-medium">{v}</p>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            {[
              ['Total Outstanding', fmt(report.total_outstanding), 'text-slate-900'],
              ['Total Overdue', fmt(report.total_overdue), 'text-red-700'],
              ['Performing', `${report.performing_percentage.toFixed(1)}%`, 'text-green-700'],
            ].map(([k, v, cls]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className={`font-bold ${cls}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CreditBureauWorkspace() {
  const { data: reportsData, isLoading: reportsLoading } = useCreditReports();
  const { data: facilitiesData, isLoading: facilitiesLoading } = useCreditFacilityRecords();
  const { data: stats } = useCreditBureauStats();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CreditReport | null>(null);
  const [scoreCheckOpen, setScoreCheckOpen] = useState(false);

  const reports = reportsData?.items ?? [];
  const facilities = facilitiesData?.items ?? [];

  const filteredReports = reports.filter(r =>
    !search || [r.id, r.customer_name, r.bvn, r.bureau].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-blue-600" />
            Credit Bureau
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            CRC, FirstCentral and CreditRegistry reports, facility records and BVN score checks
          </p>
        </div>
        <Button onClick={() => setScoreCheckOpen(true)} className="gap-2">
          <FileSearch className="w-4 h-4" /> Score Check
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Reports', value: stats.totalReports },
            { label: 'Average Score', value: stats.averageScore.toFixed(1) },
            { label: 'Total Outstanding', value: fmt(stats.totalOutstanding) },
            { label: 'Total Overdue', value: fmt(stats.totalOverdue) },
          ].map(c => (
            <Card key={c.label}><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold mt-1">{c.value}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      {stats?.byScoreBand && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.byScoreBand).map(([band, count]) => (
            <span key={band} className={`text-xs font-medium px-3 py-1 rounded-full ${SCORE_BAND_COLOR[band] ?? 'bg-gray-100 text-gray-700'}`}>
              {band}: {count}
            </span>
          ))}
        </div>
      )}

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Credit Reports</TabsTrigger>
          <TabsTrigger value="facilities">Facility Records</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Bureau Reports</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search name, BVN, bureau…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>BVN</TableHead>
                      <TableHead>Bureau</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Band</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsLoading && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {!reportsLoading && filteredReports.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No reports found</TableCell></TableRow>}
                    {filteredReports.map(r => {
                      const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.current;
                      return (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                          <TableCell className="font-mono text-xs font-medium">{r.id}</TableCell>
                          <TableCell className="font-medium text-sm">{r.customer_name}</TableCell>
                          <TableCell className="font-mono text-xs">{r.bvn}</TableCell>
                          <TableCell className="text-sm">{r.bureau}</TableCell>
                          <TableCell className="text-right font-bold">{r.credit_score}</TableCell>
                          <TableCell><span className={`text-xs font-medium px-2 py-0.5 rounded ${SCORE_BAND_COLOR[r.score_band] ?? 'bg-gray-100'}`}>{r.score_band}</span></TableCell>
                          <TableCell className="text-right text-sm">{fmt(r.total_outstanding)}</TableCell>
                          <TableCell className="text-right text-sm text-red-700">{fmt(r.total_overdue)}</TableCell>
                          <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
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

        <TabsContent value="facilities" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Facility Records</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>DPD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facilitiesLoading && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {facilities.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-xs font-medium">{f.id}</TableCell>
                        <TableCell className="text-sm">{f.institution}</TableCell>
                        <TableCell className="text-sm capitalize">{f.facility_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(f.original_amount)}</TableCell>
                        <TableCell className="text-right font-bold">{fmt(f.outstanding_balance)}</TableCell>
                        <TableCell className="text-right text-red-700">{fmt(f.overdue_amount)}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${CLASSIFICATION_COLOR[f.classification] ?? 'bg-gray-100 text-gray-700'}`}>
                            {f.classification.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{f.days_past_due}d</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ScoreCheckDialog open={scoreCheckOpen} onClose={() => setScoreCheckOpen(false)} />
      <ReportDetailSheet report={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
