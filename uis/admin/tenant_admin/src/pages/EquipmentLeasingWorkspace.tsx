import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Tractor, Plus, ChevronRight, Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useEquipmentLeasingList, useEquipmentLeasingStats, useCreateEquipmentLease } from '../hooks/useEquipmentLeasing';
import type { EquipmentLeasingRecord, CreateEquipmentLeasingPayload } from '../types/equipmentLeasing';
import kybService from '../services/kybService';
import type { Business } from '../types/kyb';

const fmtB = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  pending: 'secondary',
  closed: 'outline',
  defaulted: 'destructive',
};

function CreateLeaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateEquipmentLease();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CreateEquipmentLeasingPayload>({
    defaultValues: { type: '', amount: 0, currency: 'NGN', tenor: 12, interestRate: 0 },
  });
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);

  useEffect(() => {
    if (!open) return;
    setBizLoading(true);
    kybService.getAllBusinesses()
      .then(setBusinesses)
      .catch(() => setBusinesses([]))
      .finally(() => setBizLoading(false));
  }, [open]);

  function onSubmit(data: CreateEquipmentLeasingPayload) {
    create(data, {
      onSuccess: () => {
        reset();
        setSelectedBiz(null);
        onClose();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Equipment Lease</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Equipment Type <span className="text-destructive">*</span></Label>
              <Input {...register('type', { required: true })} placeholder="e.g. tractor, combine harvester" />
              {errors.type && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Business (Applicant)</Label>
              <Popover open={bizOpen} onOpenChange={setBizOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" type="button" className="w-full justify-between" disabled={bizLoading}>
                    {selectedBiz ? selectedBiz.name : bizLoading ? 'Loading...' : 'Select business'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search business..." />
                    <CommandList>
                      <CommandEmpty>No business found.</CommandEmpty>
                      <CommandGroup>
                        {businesses.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.name} ${b.registration_number ?? ''}`}
                            onSelect={() => {
                              setSelectedBiz(b);
                              setValue('applicant', b.name);
                              setBizOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selectedBiz?.id === b.id ? 'opacity-100' : 'opacity-0')} />
                            <div className="flex flex-col">
                              <span className="font-medium">{b.name}</span>
                              {b.registration_number && (
                                <span className="text-xs text-muted-foreground">Reg: {b.registration_number}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input {...register('currency')} defaultValue="NGN" />
            </div>
            <div className="space-y-1">
              <Label>Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" {...register('amount', { required: true, min: 1, valueAsNumber: true })} />
              {errors.amount && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Tenor (months)</Label>
              <Input type="number" {...register('tenor', { min: 1, valueAsNumber: true })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Interest Rate (%)</Label>
              <Input type="number" step="0.01" {...register('interestRate', { min: 0, valueAsNumber: true })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Lease'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaseDetailSheet({ record, open, onClose }: { record: EquipmentLeasingRecord | null; open: boolean; onClose: () => void }) {
  if (!record) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Tractor className="w-5 h-5 text-orange-600" />
            {record.id}
          </SheetTitle>
          <Badge variant={STATUS_VARIANT[record.status] ?? 'outline'}>{record.status}</Badge>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {[
            ['Type', record.type],
            ['Applicant', record.applicant ?? '—'],
            ['Currency', record.currency],
            ['Amount', fmtB(record.amount)],
            ['Tenor', `${record.tenor} months`],
            ['Interest Rate', record.interestRate != null ? `${record.interestRate}%` : '—'],
            ['Disbursed At', record.disbursedAt ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right capitalize">{v}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function EquipmentLeasingWorkspace() {
  const { data, isLoading } = useEquipmentLeasingList();
  const { data: stats } = useEquipmentLeasingStats();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<EquipmentLeasingRecord | null>(null);

  const records = data?.records ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tractor className="w-6 h-6 text-orange-600" />
            Equipment Leasing
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tractor rental marketplace and mechanization-as-a-service for agricultural financing
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Lease
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Leases', value: stats.totalActive },
            { label: 'Total Amount', value: fmtB(stats.totalAmount) },
            { label: 'NPL Ratio', value: `${stats.nplRatio}%` },
            { label: 'Avg Tenor', value: `${stats.avgTenor}mo` },
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
          <CardTitle className="text-base">Equipment Lease Register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Tenor (mo)</TableHead>
                  <TableHead className="text-right">Rate %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && records.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No equipment leases found</TableCell></TableRow>}
                {records.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                    <TableCell className="font-mono text-xs font-medium">{r.id}</TableCell>
                    <TableCell className="text-sm capitalize">{r.type}</TableCell>
                    <TableCell className="text-sm max-w-[140px] truncate">{r.applicant ?? '—'}</TableCell>
                    <TableCell className="text-right font-bold">{fmtB(r.amount)}</TableCell>
                    <TableCell className="text-right text-sm">{r.tenor}</TableCell>
                    <TableCell className="text-right text-sm">{r.interestRate != null ? `${r.interestRate}%` : '—'}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge></TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateLeaseDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <LeaseDetailSheet record={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
