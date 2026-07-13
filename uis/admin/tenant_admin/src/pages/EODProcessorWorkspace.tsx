import { useState } from 'react';
import {
  Clock, Play, ChevronRight, RefreshCw, CheckCircle2,
  XCircle, Loader2, Circle, SkipForward, AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useEodRuns, useEodRun, useEodPipeline, useTriggerEod } from '../hooks/useEod';
import type { EodRun, EodRunStatus, EodStepStatus } from '../types/eod';

// ── Config ─────────────────────────────────────────────────────────────────────

const RUN_STATUS: Record<EodRunStatus, { label: string; color: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  running:                { label: 'Running',              color: 'text-blue-600 bg-blue-50',   variant: 'secondary' },
  completed:              { label: 'Completed',            color: 'text-green-700 bg-green-50', variant: 'default' },
  completed_with_errors:  { label: 'Completed w/ Errors',  color: 'text-amber-700 bg-amber-50', variant: 'outline' },
  failed:                 { label: 'Failed',               color: 'text-red-700 bg-red-50',     variant: 'destructive' },
  cancelled:              { label: 'Cancelled',            color: 'text-gray-600 bg-gray-50',   variant: 'outline' },
};

const STEP_ICONS: Record<EodStepStatus, React.ReactNode> = {
  pending:   <Circle className="w-4 h-4 text-muted-foreground" />,
  running:   <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  failed:    <XCircle className="w-4 h-4 text-red-600" />,
  skipped:   <SkipForward className="w-4 h-4 text-muted-foreground" />,
};

const STEP_COLORS: Record<EodStepStatus, string> = {
  pending:   'bg-muted/30',
  running:   'bg-blue-50 border-blue-200',
  completed: 'bg-green-50 border-green-200',
  failed:    'bg-red-50 border-red-200',
  skipped:   'bg-muted/20',
};

function fmtDuration(secs?: number): string {
  if (secs == null) return '—';
  if (secs < 60) return `${secs.toFixed(1)}s`;
  return `${Math.floor(secs / 60)}m ${(secs % 60).toFixed(0)}s`;
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ── Trigger Dialog ─────────────────────────────────────────────────────────────

function TriggerEodDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate, isPending, error, reset } = useTriggerEod();
  const [businessDate, setBusinessDate] = useState(yesterday());

  function submit() {
    mutate({ businessDate }, { onSuccess: onClose });
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-600" /> Trigger EOD Run
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Business Date</Label>
            <Input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">EOD processes the previous business day by default.</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground">8-step pipeline will execute:</p>
            <p>EOTI Mark → Interest Accrual → Reconciliation → Settlement → GL Balance Check → CTR Extract → Audit → EOFI Mark</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {(error as Error).message}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={isPending || !businessDate} className="bg-emerald-600 hover:bg-emerald-700">
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</> : <><Play className="w-4 h-4 mr-2" /> Start Run</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Run Detail Sheet ───────────────────────────────────────────────────────────

function RunDetailSheet({ runId, open, onClose }: { runId: number | null; open: boolean; onClose: () => void }) {
  const { data: run, isLoading } = useEodRun(runId);

  const progressPct = run && run.totalSteps > 0
    ? Math.round((run.completedSteps / run.totalSteps) * 100)
    : 0;

  const statusCfg = run ? RUN_STATUS[run.status] : null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            EOD Run #{runId}
          </SheetTitle>
          {statusCfg && (
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded w-fit ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          )}
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading run details…
          </div>
        )}

        {run && (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
              {([
                ['Business Date', run.businessDate],
                ['Initiated By', run.initiatedBy],
                ['Started', run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'],
                ['Completed', run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>

            {run.status === 'running' && (
              <div className="mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{run.completedSteps} of {run.totalSteps} steps done</span>
                  <span className="font-semibold">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
            )}

            {run.errorSummary && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 mb-4 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{run.errorSummary}</span>
              </div>
            )}

            {run.steps && run.steps.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline Steps</p>
                {run.steps.map((step, i) => (
                  <div
                    key={step.stepId}
                    className={`rounded-lg border p-3 space-y-1.5 ${STEP_COLORS[step.status]}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                        {STEP_ICONS[step.status]}
                        <span className="text-sm font-medium">{step.stepName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {step.durationSeconds != null && <span>{fmtDuration(step.durationSeconds)}</span>}
                        {step.recordsProcessed > 0 && <span>{step.recordsProcessed.toLocaleString()} recs</span>}
                      </div>
                    </div>
                    {step.errorMessage && (
                      <p className="text-xs text-red-600 ml-10">{step.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Main Workspace ─────────────────────────────────────────────────────────────

export default function EODProcessorWorkspace() {
  const { data: runsData, isLoading, refetch } = useEodRuns();
  const { data: pipeline } = useEodPipeline();
  const [showTrigger, setShowTrigger] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const items = runsData?.items ?? [];
  const hasRunning = items.some((r) => r.status === 'running');

  const filtered = items.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.businessDate.includes(q) || r.status.includes(q) || r.initiatedBy.toLowerCase().includes(q);
  });

  const lastRun = items[0];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-600" />
            EOD/BOD Processing Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Orchestrated 8-step daily batch pipeline — interest accrual, settlement, GL balancing, regulatory extracts
          </p>
        </div>
        <div className="flex gap-2">
          {hasRunning && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Run in progress
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          <Button onClick={() => setShowTrigger(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Play className="w-4 h-4 mr-2" /> Trigger EOD
          </Button>
        </div>
      </div>

      {/* Last Run Summary */}
      {lastRun && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Last Business Date</p>
              <p className="text-lg font-bold mt-1">{lastRun.businessDate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Last Run Status</p>
              <div className="mt-1">
                <span className={`text-sm font-semibold px-2 py-0.5 rounded capitalize ${RUN_STATUS[lastRun.status]?.color}`}>
                  {RUN_STATUS[lastRun.status]?.label}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Steps Completed</p>
              <p className="text-lg font-bold mt-1">{lastRun.completedSteps} / {lastRun.totalSteps}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Runs</p>
              <p className="text-lg font-bold mt-1">{items.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pipeline Definition */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            Pipeline Definition
            <span className="text-xs font-normal text-muted-foreground">
              {pipeline?.total ?? 8} sequential steps — steps 1–5 are hard-required; 6–8 are best-effort
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(pipeline?.steps ?? [
              { id: 'STEP-001', name: 'EOTI Mark — lock business date', order: 1, dependsOn: [] },
              { id: 'STEP-002', name: 'Interest Accrual', order: 2, dependsOn: ['STEP-001'] },
              { id: 'STEP-003', name: 'Reconciliation', order: 3, dependsOn: ['STEP-002'] },
              { id: 'STEP-004', name: 'Settlement Finalize', order: 4, dependsOn: ['STEP-003'] },
              { id: 'STEP-005', name: 'GL Balance Check', order: 5, dependsOn: ['STEP-004'] },
              { id: 'STEP-006', name: 'CTR/Regulatory Extract', order: 6, dependsOn: ['STEP-005'] },
              { id: 'STEP-007', name: 'Audit Finalization', order: 7, dependsOn: ['STEP-006'] },
              { id: 'STEP-008', name: 'EOFI Mark — unlock for next date', order: 8, dependsOn: ['STEP-007'] },
            ]).map((step) => (
              <div
                key={step.id}
                className={`rounded-lg border p-3 space-y-1 text-sm ${step.order <= 5 ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-slate-300'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    {step.order}
                  </span>
                  <span className="text-xs font-medium leading-tight">{step.id}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug pl-7">{step.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Runs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Recent EOD Runs</CardTitle>
            <div className="relative">
              <Input
                placeholder="Search date, status, user…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-52 pl-3"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Business Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Initiated By</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" /> Loading runs…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No EOD runs found. Trigger one to get started.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((run) => {
                  const sc = RUN_STATUS[run.status];
                  const pct = run.totalSteps > 0 ? Math.round((run.completedSteps / run.totalSteps) * 100) : 0;
                  return (
                    <TableRow
                      key={run.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <TableCell className="font-mono text-xs font-semibold">#{run.id}</TableCell>
                      <TableCell className="font-medium">{run.businessDate}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${sc?.color}`}>
                          {run.status === 'running' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                          {sc?.label}
                        </span>
                      </TableCell>
                      <TableCell className="w-40">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{run.completedSteps}/{run.totalSteps}</span>
                            <span>{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {run.failedSteps > 0 ? (
                          <span className="text-red-600 font-semibold text-sm">{run.failedSteps}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{run.initiatedBy}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TriggerEodDialog open={showTrigger} onClose={() => setShowTrigger(false)} />

      <RunDetailSheet
        runId={selectedRunId}
        open={selectedRunId !== null}
        onClose={() => setSelectedRunId(null)}
      />
    </div>
  );
}
