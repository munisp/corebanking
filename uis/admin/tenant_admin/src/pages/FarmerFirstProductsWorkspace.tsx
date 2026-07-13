import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Sprout, Plus, ChevronRight, Calendar, Ticket, Warehouse, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCropCalendars,
  useCreateSeasonLoan,
  useCreateVoucher,
  useCreateWarehouseLoan,
  useCreateGroupLending,
} from '../hooks/useAgriculture';
import type {
  CropCalendar,
  CreateSeasonLoanPayload,
  CreateVoucherPayload,
  CreateWarehouseLoanPayload,
  CreateGroupLendingPayload,
} from '../types/agriculture';

const fmtM = (n: number) => {
  if (n >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  return `₦${n.toLocaleString()}`;
};

const CROP_OPTIONS = ['maize', 'cassava', 'rice', 'yam', 'cocoa', 'palm_oil', 'sorghum', 'millet', 'wheat', 'soybean'];
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

function SeasonLoanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateSeasonLoan();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateSeasonLoanPayload>({
    defaultValues: { farmer_id: '', crop_type: '', region: '', loan_type: 'seasonal', principal: 0, interest_rate: 0, expected_harvest_date: '', pay_at_harvest: false },
  });

  function onSubmit(data: CreateSeasonLoanPayload) {
    create(data, { onSuccess: () => { reset(); onClose(); } });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Season-Aligned Loan</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Farmer ID <span className="text-destructive">*</span></Label>
              <Input {...register('farmer_id', { required: true })} placeholder="FARMER-001" />
              {errors.farmer_id && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Crop Type <span className="text-destructive">*</span></Label>
              <select {...register('crop_type', { required: true })} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Select…</option>
                {CROP_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              {errors.crop_type && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Region <span className="text-destructive">*</span></Label>
              <select {...register('region', { required: true })} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Select state…</option>
                {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.region && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Principal (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} {...register('principal', { required: true, min: 1, valueAsNumber: true })} />
              {errors.principal && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Interest Rate (%)</Label>
              <Input type="number" step="0.01" min={0} {...register('interest_rate', { min: 0, valueAsNumber: true })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Expected Harvest Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register('expected_harvest_date', { required: true })} />
              {errors.expected_harvest_date && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Grace Period (days)</Label>
              <Input type="number" min={0} {...register('grace_period_days', { min: 0, valueAsNumber: true })} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="pay_at_harvest" {...register('pay_at_harvest')} className="rounded" />
              <Label htmlFor="pay_at_harvest" className="cursor-pointer">Pay at harvest</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Loan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VoucherDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateVoucher();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateVoucherPayload>({
    defaultValues: { farmer_id: '', input_type: '', amount: 0, valid_until: '' },
  });

  function onSubmit(data: CreateVoucherPayload) {
    create(data, { onSuccess: () => { reset(); onClose(); } });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Issue Input Voucher</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Farmer ID <span className="text-destructive">*</span></Label>
            <Input {...register('farmer_id', { required: true })} placeholder="FARMER-001" />
            {errors.farmer_id && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Input Type <span className="text-destructive">*</span></Label>
            <Input {...register('input_type', { required: true })} placeholder="fertilizer, seed, pesticide…" />
            {errors.input_type && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Amount (₦) <span className="text-destructive">*</span></Label>
            <Input type="number" min={1} {...register('amount', { required: true, min: 1, valueAsNumber: true })} />
            {errors.amount && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Valid Until <span className="text-destructive">*</span></Label>
            <Input type="date" {...register('valid_until', { required: true })} />
            {errors.valid_until && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Linked Loan ID</Label>
            <Input {...register('loan_id')} placeholder="LOAN-001 (optional)" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Issuing…' : 'Issue Voucher'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WarehouseLoanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateWarehouseLoan();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateWarehouseLoanPayload>({
    defaultValues: { farmer_id: '', warehouse_receipt_id: '', commodity_type: '', quantity_tonnes: 0, loan_to_value_ratio: 0.7 },
  });

  function onSubmit(data: CreateWarehouseLoanPayload) {
    create(data, { onSuccess: () => { reset(); onClose(); } });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Warehouse Receipt Loan</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Farmer ID <span className="text-destructive">*</span></Label>
            <Input {...register('farmer_id', { required: true })} placeholder="FARMER-001" />
            {errors.farmer_id && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Warehouse Receipt ID <span className="text-destructive">*</span></Label>
            <Input {...register('warehouse_receipt_id', { required: true })} placeholder="WR-001" />
            {errors.warehouse_receipt_id && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Commodity Type <span className="text-destructive">*</span></Label>
            <Input {...register('commodity_type', { required: true })} placeholder="maize, rice, sorghum…" />
            {errors.commodity_type && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>Quantity (tonnes) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.1" min={0.1} {...register('quantity_tonnes', { required: true, min: 0.1, valueAsNumber: true })} />
            {errors.quantity_tonnes && <p className="text-xs text-destructive">Required</p>}
          </div>
          <div className="space-y-1">
            <Label>LTV Ratio (e.g. 0.70)</Label>
            <Input type="number" step="0.01" min={0.1} max={0.9} {...register('loan_to_value_ratio', { min: 0.1, max: 0.9, valueAsNumber: true })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Loan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupLendingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateGroupLending();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CreateGroupLendingPayload>({
    defaultValues: { group_name: '', group_type: 'cooperative', total_loan_amount: 0, members: [{ member_id: '', name: '' }], collective_guarantee: true },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'members' });

  function onSubmit(data: CreateGroupLendingPayload) {
    create(data, { onSuccess: () => { reset(); onClose(); } });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Group Lending</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Group Name <span className="text-destructive">*</span></Label>
              <Input {...register('group_name', { required: true })} placeholder="Kano Farmers Group" />
              {errors.group_name && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>Group Type</Label>
              <select {...register('group_type')} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="cooperative">Cooperative</option>
                <option value="self_help">Self Help Group</option>
                <option value="farmers_association">Farmers Association</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Total Loan (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} {...register('total_loan_amount', { required: true, min: 1, valueAsNumber: true })} />
              {errors.total_loan_amount && <p className="text-xs text-destructive">Required</p>}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Members <span className="text-destructive">*</span></Label>
              <Button type="button" size="sm" variant="outline" onClick={() => append({ member_id: '', name: '' })}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-5 gap-2 items-center">
                <Input {...register(`members.${i}.member_id`, { required: true })} placeholder="ID" className="col-span-2" />
                <Input {...register(`members.${i}.name`, { required: true })} placeholder="Name" className="col-span-2" />
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={fields.length === 1}>✕</Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="collective_guarantee" {...register('collective_guarantee')} className="rounded" />
            <Label htmlFor="collective_guarantee" className="cursor-pointer">Collective guarantee</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Group'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CalendarDetailSheet({ calendar, open, onClose }: { calendar: CropCalendar | null; open: boolean; onClose: () => void }) {
  if (!calendar) return null;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 capitalize">
            <Calendar className="w-5 h-5 text-green-700" />
            {calendar.crop_type.replace(/_/g, ' ')} — {calendar.region}
          </SheetTitle>
          <Badge variant="secondary">{calendar.season}</Badge>
        </SheetHeader>
        <div className="space-y-3 text-sm">
          {[
            ['Planting Start', calendar.planting_start],
            ['Planting End', calendar.planting_end],
            ['Harvest Start', calendar.harvest_start],
            ['Harvest End', calendar.harvest_end],
            ['Notes', calendar.notes ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-right">{v}</span>
            </div>
          ))}
          {calendar.recommended_varieties && calendar.recommended_varieties.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">Recommended Varieties</p>
              <div className="flex flex-wrap gap-1">
                {calendar.recommended_varieties.map(v => (
                  <span key={v} className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function FarmerFirstProductsWorkspace() {
  const { data: calendarsData, isLoading: loadingCalendars } = useCropCalendars();
  const [activeDialog, setActiveDialog] = useState<'season_loan' | 'voucher' | 'warehouse' | 'group' | null>(null);
  const [selectedCalendar, setSelectedCalendar] = useState<CropCalendar | null>(null);

  const calendars = calendarsData?.calendars ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sprout className="w-6 h-6 text-green-700" />
          Farmer-First Products
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Season-aligned loans, input vouchers, warehouse receipt finance, and group lending
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Crop Calendars', value: calendarsData?.count ?? calendars.length, icon: Calendar, color: 'text-green-700' },
          { label: 'Season Loans', value: 'Create →', icon: Sprout, color: 'text-emerald-700' },
          { label: 'Input Vouchers', value: 'Issue →', icon: Ticket, color: 'text-amber-700' },
          { label: 'Group Lending', value: 'Create →', icon: Users, color: 'text-blue-700' },
        ].map(c => (
          <Card key={c.label}><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="calendars">
        <TabsList>
          <TabsTrigger value="calendars"><Calendar className="w-4 h-4 mr-1" />Crop Calendars</TabsTrigger>
          <TabsTrigger value="season_loans"><Sprout className="w-4 h-4 mr-1" />Season Loans</TabsTrigger>
          <TabsTrigger value="vouchers"><Ticket className="w-4 h-4 mr-1" />Input Vouchers</TabsTrigger>
          <TabsTrigger value="warehouse"><Warehouse className="w-4 h-4 mr-1" />Warehouse Receipts</TabsTrigger>
          <TabsTrigger value="group"><Users className="w-4 h-4 mr-1" />Group Lending</TabsTrigger>
        </TabsList>

        <TabsContent value="calendars" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Crop Calendar Registry</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Crop</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Season</TableHead>
                      <TableHead>Planting</TableHead>
                      <TableHead>Harvest</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCalendars && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {!loadingCalendars && calendars.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No crop calendars found</TableCell></TableRow>}
                    {calendars.map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCalendar(c)}>
                        <TableCell className="font-medium text-sm capitalize">{c.crop_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-sm">{c.region}</TableCell>
                        <TableCell><Badge variant="secondary">{c.season}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.planting_start} – {c.planting_end}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.harvest_start} – {c.harvest_end}</TableCell>
                        <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="season_loans" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Season-Aligned Loans</CardTitle>
                <Button onClick={() => setActiveDialog('season_loan')} className="gap-2">
                  <Plus className="w-4 h-4" /> New Loan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                Season-aligned loans are linked to crop calendars and harvest schedules. Create a new loan to get started.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vouchers" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Input Vouchers</CardTitle>
                <Button onClick={() => setActiveDialog('voucher')} className="gap-2">
                  <Plus className="w-4 h-4" /> Issue Voucher
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                Input vouchers restrict spending to approved agricultural inputs (seeds, fertilizer, pesticides) at approved merchants.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouse" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Warehouse Receipt Loans</CardTitle>
                <Button onClick={() => setActiveDialog('warehouse')} className="gap-2">
                  <Plus className="w-4 h-4" /> New Loan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                Warehouse receipt loans use stored commodities as collateral. Supports maize, rice, sorghum, and other grains.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="group" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Group Lending</CardTitle>
                <Button onClick={() => setActiveDialog('group')} className="gap-2">
                  <Plus className="w-4 h-4" /> Create Group
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                Group lending enables cooperatives and farmer associations to access collective finance with shared repayment guarantees.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SeasonLoanDialog open={activeDialog === 'season_loan'} onClose={() => setActiveDialog(null)} />
      <VoucherDialog open={activeDialog === 'voucher'} onClose={() => setActiveDialog(null)} />
      <WarehouseLoanDialog open={activeDialog === 'warehouse'} onClose={() => setActiveDialog(null)} />
      <GroupLendingDialog open={activeDialog === 'group'} onClose={() => setActiveDialog(null)} />
      <CalendarDetailSheet calendar={selectedCalendar} open={!!selectedCalendar} onClose={() => setSelectedCalendar(null)} />
    </div>
  );
}
