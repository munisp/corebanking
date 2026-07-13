import { Clock, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEodRuns } from '../hooks/useEod';
import type { EodRunStatus } from '../types/eod';

const STATUS_CONFIG: Record<EodRunStatus, { label: string; color: string }> = {
  running:               { label: 'Running',             color: 'text-blue-600 bg-blue-50 border-blue-200' },
  completed:             { label: 'Completed',           color: 'text-green-700 bg-green-50 border-green-200' },
  completed_with_errors: { label: 'Completed w/ Errors', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  failed:                { label: 'Failed',              color: 'text-red-700 bg-red-50 border-red-200' },
  cancelled:             { label: 'Cancelled',           color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

function StatusIcon({ status }: { status: EodRunStatus }) {
  if (status === 'running')   return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === 'failed')    return <XCircle className="w-4 h-4 text-red-600" />;
  return <Circle className="w-4 h-4 text-muted-foreground" />;
}

export default function BatchEodWorkspace() {
  const { data, isLoading, refetch } = useEodRuns();
  const items = data?.items ?? [];

  const completed = items.filter((r) => r.status === 'completed').length;
  const failed    = items.filter((r) => r.status === 'failed').length;
  const running   = items.filter((r) => r.status === 'running').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-600" />
            Batch / EOD Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            EOD run history overview — go to <strong>EOD Processor</strong> to trigger and monitor individual runs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Runs</p>
            <p className="text-2xl font-bold mt-1">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Currently Running</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{running}</p>
          </CardContent>
        </Card>
      </div>

      {/* Run Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No EOD runs yet. Use <strong>EOD Processor</strong> to trigger a run.
            </div>
          )}
          {items.map((run) => {
            const sc = STATUS_CONFIG[run.status];
            const pct = run.totalSteps > 0 ? Math.round((run.completedSteps / run.totalSteps) * 100) : 0;
            return (
              <div key={run.id} className={`rounded-lg border p-4 space-y-3 ${sc.color}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={run.status} />
                    <span className="font-semibold text-sm">Run #{run.id}</span>
                    <span className="text-sm text-muted-foreground">— {run.businessDate}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>by {run.initiatedBy}</span>
                    <span>{new Date(run.startedAt).toLocaleDateString()}</span>
                    {run.failedSteps > 0 && (
                      <Badge variant="destructive" className="text-xs">{run.failedSteps} failed</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{run.completedSteps} of {run.totalSteps} steps</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
