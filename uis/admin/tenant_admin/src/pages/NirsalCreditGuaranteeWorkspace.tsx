import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Shield, Plus, Search, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNIRSALList, useNIRSALStats, useCreateNIRSAL } from '../hooks/useNirsalGuarantee';
import type { NIRSALRecord, CreateNIRSALPayload, NIRSALRecordType } from '../types/nirsalGuarantee';

const fmt = (n: number) => `₦${n.toLocaleString()}`;

const TYPE_LABELS: Record<NIRSALRecordType, string> = {
  active_facility: 'Active Facility',
  insurance_claim: 'Insurance Claim',
  guarantee: 'Guarantee',
};

const TYPE_COLORS: Record<NIRSALRecordType, string> = {
  active_facility: 'bg-green-100 text-green-700',
  insurance_claim: 'bg-red-100 text-red-700',
  guarantee: 'bg-blue-100 text-blue-700',
};

const STATUS_CFG: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  disbursed: { variant: 'default' },
  active: { variant: 'default' },
  under_assessment: { variant: 'secondary' },
  initiated: { variant: 'secondary' },
  completed: { variant: 'outline' },
  rejected: { variant: 'destructive' },
};

function CreateNIRSALDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateNIRSAL();
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<CreateNIRSALPayload>({
    defaultValues: { type: 'active_facility' },
  });
  const type = watch('type');

  function onSubmit(data: CreateNIRSALPayload) {
    create(data, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> New NIRSAL Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Record Type <span className="text-destructive">*</span></Label>
            <Controller name="type" control={control} rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={v => field.onChange(v as NIRSALRecordType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as NIRSALRecordType[]).map(t => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Farmer / Coop ID <span className="text-destructive">*</span></Label>
              <Input {...register('farmer', { required: true })} placeholder="COOP-KADUNA-001" />
              {errors.farmer && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Crop</Label>
              <Input {...register('crop')} placeholder="maize, rice, sorghum…" />
            </div>
            <div className="space-y-1">
              <Label>Hectares</Label>
              <Input type="number" {...register('hectares', { min: 0, valueAsNumber: true })} />
            </div>
            {type === 'active_facility' && (
              <div className="space-y-1">
                <Label>Amount (₦)</Label>
                <Input type="number" {...register('amount', { min: 0, valueAsNumber: true })} />
              </div>
            )}
            {type === 'insurance_claim' && (
              <>
                <div className="space-y-1">
                  <Label>Loss %</Label>
                  <Input type="number" {...register('lossPercent', { min: 0, max: 100, valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Cause</Label>
                  <Input {...register('cause')} placeholder="flood, drought, pest…" />
                </div>
              </>
            )}
            {type === 'guarantee' && (
              <div className="space-y-1">
                <Label>Guarantee Amount (₦)</Label>
                <Input type="number" {...register('guaranteeAmount', { min: 0, valueAsNumber: true })} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Season</Label>
              <Input {...register('season')} placeholder="2026A" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Record'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordDetailSheet({ record, open, onClose }: { record: NIRSALRecord | null; open: boolean; onClose: () => void }) {
  if (!record) return null;
  const fields = Object.entries(record).filter(([k, v]) => k !== 'id' && k !== 'type' && v !== undefined && v !== null);
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-700" />
            {record.id}
          </SheetTitle>
          <span className={`text-xs font-medium px-2 py-0.5 rounded w-fit ${TYPE_COLORS[record.type] ?? 'bg-gray-100 text-gray-700'}`}>
            {TYPE_LABELS[record.type] ?? record.type}
          </span>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
              <span className="font-medium text-right">{String(v)}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function NirsalCreditGuaranteeWorkspace() {
  const { data: listData, isLoading } = useNIRSALList();
  const { data: stats } = useNIRSALStats();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<NIRSALRecord | null>(null);

  const records = listData?.records ?? [];
  const filtered = records.filter(r => {
    const matchSearch = !search || [r.id, r.farmer, r.crop, r.cause].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    return matchSearch && (filterType === 'all' || r.type === filterType);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-700" />
            NIRSAL Credit Guarantee
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agricultural credit guarantee records, insurance claims and active facility tracking
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Record
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Farmers', value: stats.totalFarmers.toLocaleString() },
            { label: 'Active Facilities', value: stats.activeFacilities.toLocaleString() },
            { label: 'Total Disbursed', value: fmt(stats.totalDisbursed) },
            { label: 'Avg Loan Size', value: fmt(stats.avgLoanSize) },
            { label: 'Repayment Rate', value: `${stats.repaymentRate}%` },
            { label: 'Season', value: stats.season },
          ].map(c => (
            <Card key={c.label}><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold mt-1">{c.value}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Records</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search farmer, crop…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-48" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {(Object.keys(TYPE_LABELS) as NIRSALRecordType[]).map(t => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(search || filterType !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterType('all'); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Farmer / Coop</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No records found</TableCell></TableRow>}
                {filtered.map(r => {
                  const sCfg = STATUS_CFG[r.status] ?? { variant: 'outline' as const };
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                      <TableCell className="font-mono text-xs font-medium">{r.id}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {TYPE_LABELS[r.type]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{r.farmer}</TableCell>
                      <TableCell className="text-sm capitalize">{r.crop ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.type === 'active_facility' && r.amount ? fmt(r.amount) : ''}
                        {r.type === 'insurance_claim' && r.lossPercent != null ? `${r.lossPercent}% loss · ${r.cause ?? ''}` : ''}
                        {r.type === 'guarantee' && r.guaranteeAmount ? fmt(r.guaranteeAmount) : ''}
                      </TableCell>
                      <TableCell><Badge variant={sCfg.variant} className="capitalize">{r.status.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateNIRSALDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <RecordDetailSheet record={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
