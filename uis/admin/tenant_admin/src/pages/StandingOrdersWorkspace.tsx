import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  RepeatIcon, Plus, Pause, Play, Ban, ChevronRight, Calendar, Clock,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useStandingOrderList, useCreateStandingOrder, usePauseStandingOrder,
  useResumeStandingOrder, useSODirectDebitList, useCreateSOMandate,
  useRevokeSOMandate, useScheduledPaymentList, useCreateScheduledPayment,
} from '../hooks/useStandingOrders';
import type {
  StandingOrder, CreateStandingOrderPayload, DirectDebitMandate, CreateMandatePayload,
  ScheduledPayment, CreateScheduledPaymentPayload, SOFrequency, PaymentType,
} from '../types/standingOrders';

function fmt(n: number) {
  return `₦${n.toLocaleString()}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
  failed: 'bg-red-100 text-red-700',
  pending_consent: 'bg-amber-100 text-amber-700',
  suspended: 'bg-orange-100 text-orange-700',
  revoked: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
  scheduled: 'bg-blue-100 text-blue-700',
  executed: 'bg-green-100 text-green-700',
};

const FREQUENCIES: SOFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];

// ─── Create Standing Order Dialog ────────────────────────────────────────────

function CreateOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateStandingOrder();
  const { register, control, handleSubmit, formState: { errors } } = useForm<CreateStandingOrderPayload>({
    defaultValues: { frequency: 'monthly' },
  });

  function onSubmit(data: CreateStandingOrderPayload) {
    create({ ...data, amount: Number(data.amount) }, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Create Standing Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Account ID <span className="text-destructive">*</span></Label>
              <Input {...register('accountId', { required: 'Required' })} placeholder="ACC-001" />
              {errors.accountId && <p className="text-xs text-destructive">{errors.accountId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Beneficiary ID <span className="text-destructive">*</span></Label>
              <Input {...register('beneficiaryId', { required: 'Required' })} placeholder="BEN-001" />
              {errors.beneficiaryId && <p className="text-xs text-destructive">{errors.beneficiaryId.message}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Beneficiary Name <span className="text-destructive">*</span></Label>
              <Input {...register('beneficiaryName', { required: 'Required' })} placeholder="John Doe" />
              {errors.beneficiaryName && <p className="text-xs text-destructive">{errors.beneficiaryName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" {...register('amount', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} placeholder="50000" />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Frequency <span className="text-destructive">*</span></Label>
              <Controller
                name="frequency"
                control={control}
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as SOFrequency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" {...register('startDate')} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" {...register('endDate')} />
            </div>
            <div className="space-y-1">
              <Label>Max Executions</Label>
              <Input type="number" {...register('maxExecutions', { min: 0 })} placeholder="0 = unlimited" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Narration <span className="text-destructive">*</span></Label>
              <Input {...register('narration', { required: 'Required' })} placeholder="Monthly rent payment" />
              {errors.narration && <p className="text-xs text-destructive">{errors.narration.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Order'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Mandate Dialog ────────────────────────────────────────────────────

function CreateMandateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateSOMandate();
  const { register, control, handleSubmit, formState: { errors } } = useForm<CreateMandatePayload>({
    defaultValues: { frequency: 'monthly' },
  });

  function onSubmit(data: CreateMandatePayload) {
    create({ ...data, maxAmount: Number(data.maxAmount) }, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Direct Debit Mandate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Merchant ID <span className="text-destructive">*</span></Label>
              <Input {...register('merchantId', { required: 'Required' })} placeholder="MERCH-001" />
              {errors.merchantId && <p className="text-xs text-destructive">{errors.merchantId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Merchant Name <span className="text-destructive">*</span></Label>
              <Input {...register('merchantName', { required: 'Required' })} placeholder="DSTV Nigeria" />
              {errors.merchantName && <p className="text-xs text-destructive">{errors.merchantName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Customer ID <span className="text-destructive">*</span></Label>
              <Input {...register('customerId', { required: 'Required' })} placeholder="CIF-100" />
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Account ID <span className="text-destructive">*</span></Label>
              <Input {...register('accountId', { required: 'Required' })} placeholder="ACC-001" />
              {errors.accountId && <p className="text-xs text-destructive">{errors.accountId.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Max Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" {...register('maxAmount', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
              {errors.maxAmount && <p className="text-xs text-destructive">{errors.maxAmount.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Controller
                name="frequency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as SOFrequency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Expiry Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register('expiryDate', { required: 'Required' })} />
              {errors.expiryDate && <p className="text-xs text-destructive">{errors.expiryDate.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Mandate'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule Payment Dialog ──────────────────────────────────────────────────

function CreatePaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateScheduledPayment();
  const { register, control, handleSubmit, formState: { errors } } = useForm<CreateScheduledPaymentPayload>({
    defaultValues: { paymentType: 'transfer' },
  });

  function onSubmit(data: CreateScheduledPaymentPayload) {
    create({ ...data, amount: Number(data.amount) }, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Schedule Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Account ID <span className="text-destructive">*</span></Label>
            <Input {...register('accountId', { required: 'Required' })} placeholder="ACC-001" />
            {errors.accountId && <p className="text-xs text-destructive">{errors.accountId.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Payment Type</Label>
            <Controller
              name="paymentType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as PaymentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="bill_payment">Bill Payment</SelectItem>
                    <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Amount (₦) <span className="text-destructive">*</span></Label>
            <Input type="number" {...register('amount', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Scheduled At <span className="text-destructive">*</span></Label>
            <Input type="datetime-local" {...register('scheduledAt', { required: 'Required' })} />
            {errors.scheduledAt && <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Scheduling…' : 'Schedule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function StandingOrdersTab() {
  const { data, isLoading } = useStandingOrderList();
  const { mutate: pause, isPending: pausing } = usePauseStandingOrder();
  const { mutate: resume, isPending: resuming } = useResumeStandingOrder();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const items = data?.items ?? [];
  const filtered = items.filter((o) => {
    const matchSearch = !search || [o.id, o.accountId, o.beneficiaryName, o.narration].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    return matchSearch && (filterStatus === 'all' || o.status === filterStatus);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {['active', 'paused', 'completed', 'cancelled', 'failed'].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Order
        </Button>
      </div>
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Beneficiary</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Execution</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No standing orders</TableCell></TableRow>}
            {filtered.map((o: StandingOrder) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id}</TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{o.beneficiaryName}</p>
                  <p className="text-xs text-muted-foreground">{o.accountId}</p>
                </TableCell>
                <TableCell className="text-right font-medium">{fmt(o.amount)}</TableCell>
                <TableCell className="capitalize text-sm">{o.frequency}</TableCell>
                <TableCell className="text-sm">{o.nextExecutionAt || '—'}</TableCell>
                <TableCell className="text-sm">{o.executionCount}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    {o.status === 'active' && (
                      <Button variant="ghost" size="icon" onClick={() => pause(o.id)} disabled={pausing}>
                        <Pause className="w-4 h-4" />
                      </Button>
                    )}
                    {o.status === 'paused' && (
                      <Button variant="ghost" size="icon" onClick={() => resume(o.id)} disabled={resuming}>
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CreateOrderDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function MandatesTab() {
  const { data, isLoading } = useSODirectDebitList();
  const { mutate: revoke, isPending: revoking } = useRevokeSOMandate();
  const [revokeTarget, setRevokeTarget] = useState<DirectDebitMandate | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const items = data?.items ?? [];
  const filtered = items.filter((m) =>
    !search || [m.id, m.merchantName, m.customerId, m.accountId].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-between">
        <Input placeholder="Search mandate…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> New Mandate</Button>
      </div>
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mandate ID</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Customer / Account</TableHead>
              <TableHead className="text-right">Max Amount</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No mandates</TableCell></TableRow>}
            {filtered.map((m: DirectDebitMandate) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.id}</TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{m.merchantName}</p>
                  <p className="text-xs text-muted-foreground">{m.merchantId}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{m.customerId}</p>
                  <p className="text-xs text-muted-foreground">{m.accountId}</p>
                </TableCell>
                <TableCell className="text-right font-medium">{fmt(m.maxAmount)}</TableCell>
                <TableCell className="capitalize text-sm">{m.frequency}</TableCell>
                <TableCell className="text-sm">{m.expiryDate || '—'}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${STATUS_COLORS[m.status] ?? 'bg-gray-100 text-gray-600'}`}>{m.status}</span>
                </TableCell>
                <TableCell>
                  {m.status === 'active' || m.status === 'pending_consent' ? (
                    <Button variant="ghost" size="icon" onClick={() => setRevokeTarget(m)}>
                      <Ban className="w-4 h-4 text-destructive" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CreateMandateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke mandate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the direct debit mandate for <strong>{revokeTarget?.merchantName}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (revokeTarget) revoke(revokeTarget.id, { onSuccess: () => setRevokeTarget(null) }); }}
              disabled={revoking}
            >
              {revoking ? 'Revoking…' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ScheduledPaymentsTab() {
  const { data, isLoading } = useScheduledPaymentList();
  const [createOpen, setCreateOpen] = useState(false);

  const items = data?.scheduledPayments ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
          <Calendar className="w-4 h-4" /> Schedule Payment
        </Button>
      </div>
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment ID</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Scheduled At</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No scheduled payments</TableCell></TableRow>}
            {items.map((p: ScheduledPayment) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="text-sm">{p.accountId}</TableCell>
                <TableCell className="capitalize text-sm">{p.paymentType.replace('_', ' ')}</TableCell>
                <TableCell className="text-right font-medium">{fmt(p.amount)}</TableCell>
                <TableCell className="text-sm">{new Date(p.scheduledAt).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CreatePaymentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StandingOrdersWorkspace() {
  const { data: ordersData } = useStandingOrderList();
  const { data: mandatesData } = useSODirectDebitList();
  const { data: paymentsData } = useScheduledPaymentList();

  const totalOrders = ordersData?.total ?? 0;
  const activeOrders = ordersData?.items?.filter((o) => o.status === 'active').length ?? 0;
  const totalMandates = mandatesData?.total ?? 0;
  const totalPayments = paymentsData?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RepeatIcon className="w-6 h-6 text-violet-600" />
          Standing Orders
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Recurring transfers, direct debit mandates, and scheduled payments
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: totalOrders },
          { label: 'Active Orders', value: activeOrders },
          { label: 'Direct Debit Mandates', value: totalMandates },
          { label: 'Scheduled Payments', value: totalPayments },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Order Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="orders">
            <TabsList className="mb-4">
              <TabsTrigger value="orders">Standing Orders</TabsTrigger>
              <TabsTrigger value="mandates">Direct Debit Mandates</TabsTrigger>
              <TabsTrigger value="payments">Scheduled Payments</TabsTrigger>
            </TabsList>
            <TabsContent value="orders"><StandingOrdersTab /></TabsContent>
            <TabsContent value="mandates"><MandatesTab /></TabsContent>
            <TabsContent value="payments"><ScheduledPaymentsTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
