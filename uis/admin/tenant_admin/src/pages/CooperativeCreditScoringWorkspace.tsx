import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { BarChart3, Plus, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCoopCreditList, useCoopCreditStats, useCreateMLRecord } from '../hooks/useCooperativeCreditScoring';
import type { MLModelRecord, CreateMLRecordPayload } from '../types/cooperativeCreditScoring';

function CreateModelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateMLRecord();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateMLRecordPayload>({
    defaultValues: { model: '', accuracy: undefined },
  });

  function onSubmit(data: CreateMLRecordPayload) {
    create(data, { onSuccess: () => { reset(); onClose(); } });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Register ML Model</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Model Name <span className="text-destructive">*</span></Label>
            <Input {...register('model', { required: true })} placeholder="e.g. credit_scoring_v3" />
            {errors.model && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Accuracy (%)</Label>
            <Input type="number" step="0.01" min={0} max={100} {...register('accuracy', { min: 0, max: 100, valueAsNumber: true })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Registering…' : 'Register Model'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModelDetailSheet({ model, open, onClose }: { model: MLModelRecord | null; open: boolean; onClose: () => void }) {
  if (!model) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            {model.model}
          </SheetTitle>
          <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>{model.status ?? 'unknown'}</Badge>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {[
            ['Model ID', model.id],
            ['Accuracy', model.accuracy != null ? `${model.accuracy}%` : '—'],
            ['F1 Score', model.f1Score != null ? model.f1Score.toFixed(4) : '—'],
            ['Gini Coefficient', model.giniCoefficient != null ? model.giniCoefficient.toFixed(4) : '—'],
            ['Precision', model.precision != null ? `${model.precision}%` : '—'],
            ['Last Trained', model.lastTrained ?? '—'],
            ['Predictions (24h)', model.predictions24h != null ? model.predictions24h.toLocaleString() : '—'],
            ['Scored (24h)', model.scored24h != null ? model.scored24h.toLocaleString() : '—'],
            ['Created At', model.createdAt ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CooperativeCreditScoringWorkspace() {
  const { data, isLoading } = useCoopCreditList();
  const { data: stats } = useCoopCreditStats();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MLModelRecord | null>(null);

  const records = data?.records ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            Cooperative Credit Scoring
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ML model registry — fraud detection, credit scoring, churn prediction for cooperative lending
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Register Model
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Models Deployed', value: stats.modelsDeployed },
            { label: 'Predictions (24h)', value: stats.totalPredictions24h?.toLocaleString() ?? '—' },
            { label: 'Avg Latency', value: stats.avgLatencyMs != null ? `${stats.avgLatencyMs}ms` : '—' },
            { label: 'GPU Utilization', value: stats.gpuUtilization != null ? `${stats.gpuUtilization}%` : '—' },
          ].map(c => (
            <Card key={c.label}><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold mt-1">{String(c.value)}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ML Model Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">F1 Score</TableHead>
                  <TableHead className="text-right">Gini</TableHead>
                  <TableHead className="text-right">Predictions (24h)</TableHead>
                  <TableHead>Last Trained</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && records.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No models registered</TableCell></TableRow>}
                {records.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                    <TableCell className="font-medium text-sm">{r.model}</TableCell>
                    <TableCell className="text-right text-sm">{r.accuracy != null ? `${r.accuracy}%` : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{r.f1Score != null ? r.f1Score.toFixed(4) : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{r.giniCoefficient != null ? r.giniCoefficient.toFixed(4) : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{r.predictions24h != null ? r.predictions24h.toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-sm">{r.lastTrained ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status ?? 'unknown'}</Badge>
                    </TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateModelDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ModelDetailSheet model={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
