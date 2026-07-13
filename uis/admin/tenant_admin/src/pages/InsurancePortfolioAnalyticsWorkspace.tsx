import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { PieChart, Plus, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  useInsuranceAnalyticsList, useInsuranceAnalyticsStats, useCreateInsuranceRecord,
} from '../hooks/useInsuranceAnalytics';
import type { InsuranceRecord, CreateInsuranceRecordPayload, InsuranceRecordType } from '../types/insuranceAnalytics';

const TYPE_COLORS: Record<string, string> = {
  crop_assessment: 'bg-green-100 text-green-700',
  insurance_claim: 'bg-red-100 text-red-700',
  price_index: 'bg-blue-100 text-blue-700',
};

const TYPE_LABELS: Record<InsuranceRecordType, string> = {
  crop_assessment: 'Crop Assessment',
  insurance_claim: 'Insurance Claim',
  price_index: 'Price Index',
};

function CreateRecordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateInsuranceRecord();
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<CreateInsuranceRecordPayload>({
    defaultValues: { type: 'crop_assessment' },
  });
  const type = watch('type');

  function onSubmit(data: CreateInsuranceRecordPayload) {
    create(data, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Record Type <span className="text-destructive">*</span></Label>
            <Controller name="type" control={control} rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as InsuranceRecordType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as InsuranceRecordType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {(type === 'crop_assessment' || type === 'insurance_claim') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Farmer / Coop ID</Label>
                  <Input {...register('farmer')} placeholder="COOP-KADUNA-001" />
                </div>
                <div className="space-y-1">
                  <Label>Crop</Label>
                  <Input {...register('crop')} placeholder="maize, rice, sorghum…" />
                </div>
              </div>
              {type === 'crop_assessment' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Hectares</Label>
                    <Input type="number" {...register('hectares', { min: 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Yield Estimate (t/ha)</Label>
                    <Input type="number" step="0.1" {...register('yieldEstimate', { min: 0 })} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Season</Label>
                    <Input {...register('season')} placeholder="2026A" />
                  </div>
                </div>
              )}
              {type === 'insurance_claim' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Loss % <span className="text-destructive">*</span></Label>
                    <Input type="number" {...register('lossPercent', { required: type === 'insurance_claim', min: 0, max: 100 })} />
                    {errors.lossPercent && <p className="text-xs text-destructive">Required</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Cause</Label>
                    <Input {...register('cause')} placeholder="flood, drought, pest…" />
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'price_index' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Commodity</Label>
                <Input {...register('commodity')} placeholder="maize" />
              </div>
              <div className="space-y-1">
                <Label>Price (₦)</Label>
                <Input type="number" {...register('price', { min: 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Input {...register('unit')} placeholder="per_ton" />
              </div>
              <div className="space-y-1">
                <Label>Market</Label>
                <Input {...register('market')} placeholder="Lagos" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Date</Label>
                <Input type="date" {...register('date')} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Record'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordDetailSheet({ record, open, onClose }: { record: InsuranceRecord | null; open: boolean; onClose: () => void }) {
  if (!record) return null;
  const label = TYPE_LABELS[record.type] ?? record.type;
  const fields = Object.entries(record).filter(([k, v]) => k !== 'id' && k !== 'type' && v !== undefined && v !== null && v !== '');
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-600" /> {record.id}
          </SheetTitle>
          <span className={`text-xs font-medium px-2 py-0.5 rounded w-fit ${TYPE_COLORS[record.type] ?? 'bg-gray-100 text-gray-700'}`}>{label}</span>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {fields.map(([k, v]) => (
            <div key={k}>
              <p className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
              <p className="font-medium">{String(v)}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function InsurancePortfolioAnalyticsWorkspace() {
  const { data: listData, isLoading } = useInsuranceAnalyticsList();
  const { data: stats } = useInsuranceAnalyticsStats();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<InsuranceRecord | null>(null);

  const records = listData?.records ?? [];

  const filtered = records.filter((r) => {
    const matchSearch = !search || [r.id, r.farmer, r.crop, r.commodity, r.market, r.cause].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    return matchSearch && (filterType === 'all' || r.type === filterType);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="w-6 h-6 text-emerald-600" />
            Insurance Portfolio Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crop assessments, insurance claims, and commodity price indices
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Record
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Farmers', value: stats.totalFarmers.toLocaleString() },
            { label: 'Active Policies', value: stats.activePolicies.toLocaleString() },
            { label: 'Pending Claims', value: stats.pendingClaims },
            { label: 'Avg Yield (t/ha)', value: stats.avgYield.toFixed(1) },
            { label: 'Total Hectares', value: stats.totalHectares.toLocaleString() },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
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
                <Input placeholder="Search farmer, crop, market…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-52" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {(Object.keys(TYPE_LABELS) as InsuranceRecordType[]).map((t) => (
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
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No records found</TableCell></TableRow>}
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                    <TableCell className="font-mono text-xs font-medium">{r.id}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.type === 'crop_assessment' && `${r.crop} · ${r.hectares}ha · ${r.farmer}`}
                      {r.type === 'insurance_claim' && `${r.crop} · ${r.lossPercent}% loss · ${r.cause}`}
                      {r.type === 'price_index' && `${r.commodity} · ₦${r.price?.toLocaleString()} ${r.unit} · ${r.market}`}
                    </TableCell>
                    <TableCell>
                      {r.status && (
                        <Badge variant={r.status === 'under_assessment' ? 'secondary' : r.status === 'created' ? 'outline' : 'default'} className="capitalize">
                          {r.status.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateRecordDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <RecordDetailSheet record={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
