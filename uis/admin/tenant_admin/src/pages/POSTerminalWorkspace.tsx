import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Store,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  TrendingUp,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import {
  usePosTerminals,
  usePosTransactions,
  usePosStats,
  useCreatePosTerminal,
  useCreatePosTransaction,
} from '@/hooks/usePos';
import type {
  POSTerminal,
  POSTerminalStatus,
  POSTransactionStatus,
  POSTransactionType,
  CardScheme,
  CreatePOSTerminalPayload,
  CreatePOSTransactionPayload,
} from '@/types/pos';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function fmtCurrency(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

function fmtDate(s?: string) {
  if (!s) return '—';
  try { return format(parseISO(s), 'dd MMM yyyy, HH:mm'); }
  catch { return s; }
}

function fmtShortDate(s?: string) {
  if (!s) return '—';
  try { return format(parseISO(s), 'dd MMM yyyy'); }
  catch { return s; }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

// ─── Status badges ───────────────────────────────────────────────────────────

function TerminalStatusBadge({ status }: { status: POSTerminalStatus }) {
  const map: Record<POSTerminalStatus, { label: string; className: string }> = {
    active:    { label: 'Active',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    inactive:  { label: 'Inactive',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
    suspended: { label: 'Suspended', className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const cfg = map[status] ?? { label: capitalize(status), className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function TxnStatusBadge({ status }: { status: POSTransactionStatus }) {
  const map: Record<POSTransactionStatus, { label: string; className: string }> = {
    approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    declined: { label: 'Declined', className: 'bg-red-100 text-red-700 border-red-200' },
    pending:  { label: 'Pending',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
    reversed: { label: 'Reversed', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  };
  const cfg = map[status] ?? { label: capitalize(status), className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function TxnTypeBadge({ type }: { type: POSTransactionType }) {
  const map: Record<string, string> = {
    purchase:         'bg-blue-100 text-blue-700 border-blue-200',
    refund:           'bg-amber-100 text-amber-700 border-amber-200',
    reversal:         'bg-purple-100 text-purple-700 border-purple-200',
    balance_inquiry:  'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {capitalize(type)}
    </Badge>
  );
}

function CardSchemeBadge({ scheme }: { scheme: CardScheme }) {
  const map: Record<string, string> = {
    Visa:       'bg-blue-50 text-blue-700 border-blue-200',
    Mastercard: 'bg-orange-50 text-orange-700 border-orange-200',
    Verve:      'bg-green-50 text-green-700 border-green-200',
    Amex:       'bg-sky-50 text-sky-700 border-sky-200',
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${map[scheme] ?? 'bg-gray-100 text-gray-600'}`}>
      {scheme}
    </Badge>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
  loading?: boolean;
}

function StatCard({ title, value, icon, iconBg, sub, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-lg shrink-0 ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-24 mt-1" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
          {sub && !loading && (
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton rows ───────────────────────────────────────────────────────────

function TableSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPage }: {
  page: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between px-2 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-2">{page} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Terminal Detail Sheet ───────────────────────────────────────────────────

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function TerminalDetailSheet({ terminal, open, onClose }: {
  terminal: POSTerminal | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!terminal) return null;

  const approvalRate =
    terminal.dailyTransactionCount > 0
      ? '—'
      : '—';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {terminal.terminalId}
          </SheetTitle>
          <SheetDescription>{terminal.merchantName} · {terminal.location}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6 pr-4">
            {/* Status & category */}
            <div className="flex items-center gap-2 flex-wrap">
              <TerminalStatusBadge status={terminal.status} />
              <Badge variant="secondary" className="text-xs">{capitalize(terminal.category)}</Badge>
              <Badge variant="outline" className="text-xs">{terminal.model}</Badge>
            </div>

            <Separator />

            {/* Merchant info */}
            <div>
              <p className="text-sm font-medium mb-3">Merchant</p>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Merchant Name" value={terminal.merchantName} />
                <Detail label="Merchant ID" value={terminal.merchantId} />
                <Detail label="Location" value={terminal.location} />
                <Detail label="State" value={terminal.state} />
                <Detail label="Category" value={capitalize(terminal.category)} />
                <Detail label="Model" value={terminal.model} />
              </div>
            </div>

            <Separator />

            {/* Volume metrics */}
            <div>
              <p className="text-sm font-medium mb-3">Transaction Metrics</p>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Daily Transactions" value={terminal.dailyTransactionCount.toLocaleString()} />
                <Detail label="Daily Volume" value={fmtCurrency(terminal.dailyVolume)} />
                <Detail label="Monthly Volume" value={fmtCurrency(terminal.monthlyVolume)} />
                <Detail label="Commission Rate" value={`${terminal.commissionRate}%`} />
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div>
              <p className="text-sm font-medium mb-3">Dates</p>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Deployed Date" value={fmtShortDate(terminal.deployedDate)} />
                <Detail label="Last Transaction" value={fmtDate(terminal.lastTransaction)} />
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── Deploy Terminal Dialog ───────────────────────────────────────────────────

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
];

const POS_MODELS = ['PAX A920','PAX A9','Verifone V240m','Verifone VX820','Ingenico Desk 3500','Rongta RPP300','Sunmi P2 Pro'];
const POS_CATEGORIES = ['supermarket','fuel','retail','restaurant','pharmacy','hotel','hospital','transport','other'];

function DeployTerminalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: createTerminal, isPending } = useCreatePosTerminal();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreatePOSTerminalPayload>({
    defaultValues: { status: 'active', commissionRate: 0.75 },
  });

  function onSubmit(data: CreatePOSTerminalPayload) {
    createTerminal(data, {
      onSuccess: () => { reset(); onClose(); },
    });
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-teal-600" />
            Deploy New Terminal
          </DialogTitle>
          <DialogDescription>
            Register a new POS terminal for a merchant. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Terminal ID */}
            <div className="space-y-1.5">
              <Label>Terminal ID *</Label>
              <Input
                placeholder="e.g. 2054B004"
                {...register('terminalId', { required: 'Terminal ID is required' })}
                className={errors.terminalId ? 'border-red-500' : ''}
              />
              {errors.terminalId && <p className="text-xs text-red-500">{errors.terminalId.message}</p>}
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label>Model *</Label>
              <Controller
                name="model"
                control={control}
                rules={{ required: 'Model is required' }}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.model ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POS_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.model && <p className="text-xs text-red-500">{errors.model.message}</p>}
            </div>
          </div>

          {/* Merchant Name */}
          <div className="space-y-1.5">
            <Label>Merchant Name *</Label>
            <Input
              placeholder="e.g. Shoprite Lekki"
              {...register('merchantName', { required: 'Merchant name is required' })}
              className={errors.merchantName ? 'border-red-500' : ''}
            />
            {errors.merchantName && <p className="text-xs text-red-500">{errors.merchantName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Merchant ID */}
            <div className="space-y-1.5">
              <Label>Merchant ID *</Label>
              <Input
                placeholder="e.g. MER-004"
                {...register('merchantId', { required: 'Merchant ID is required' })}
                className={errors.merchantId ? 'border-red-500' : ''}
              />
              {errors.merchantId && <p className="text-xs text-red-500">{errors.merchantId.message}</p>}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Controller
                name="category"
                control={control}
                rules={{ required: 'Category is required' }}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POS_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Location *</Label>
            <Input
              placeholder="e.g. Lekki Phase 1"
              {...register('location', { required: 'Location is required' })}
              className={errors.location ? 'border-red-500' : ''}
            />
            {errors.location && <p className="text-xs text-red-500">{errors.location.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* State */}
            <div className="space-y-1.5">
              <Label>State *</Label>
              <Controller
                name="state"
                control={control}
                rules={{ required: 'State is required' }}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.state ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {NIGERIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
            </div>

            {/* Commission Rate */}
            <div className="space-y-1.5">
              <Label>Commission Rate (%) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 0.75"
                {...register('commissionRate', {
                  required: 'Commission rate is required',
                  valueAsNumber: true,
                  min: { value: 0, message: 'Must be ≥ 0' },
                  max: { value: 100, message: 'Must be ≤ 100' },
                })}
                className={errors.commissionRate ? 'border-red-500' : ''}
              />
              {errors.commissionRate && <p className="text-xs text-red-500">{errors.commissionRate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? 'active'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Deployed Date */}
            <div className="space-y-1.5">
              <Label>Deployed Date</Label>
              <Input type="date" {...register('deployedDate')} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deploy Terminal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Transaction Dialog ────────────────────────────────────────────────

function RecordTransactionDialog({
  open,
  onClose,
  terminals,
}: {
  open: boolean;
  onClose: () => void;
  terminals: POSTerminal[];
}) {
  const { mutate: createTransaction, isPending } = useCreatePosTransaction();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreatePOSTransactionPayload>({
    defaultValues: { currency: 'NGN', status: 'pending' },
  });

  function onSubmit(data: CreatePOSTransactionPayload) {
    createTransaction(data, {
      onSuccess: () => { reset(); onClose(); },
    });
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Record Transaction
          </DialogTitle>
          <DialogDescription>
            Manually record a POS transaction. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Terminal */}
          <div className="space-y-1.5">
            <Label>Terminal *</Label>
            <Controller
              name="terminalId"
              control={control}
              rules={{ required: 'Terminal is required' }}
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger className={errors.terminalId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select terminal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {terminals.map((t) => (
                      <SelectItem key={t.id} value={t.terminalId}>
                        {t.terminalId} — {t.merchantName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.terminalId && <p className="text-xs text-red-500">{errors.terminalId.message}</p>}
          </div>

          {/* Merchant Name */}
          <div className="space-y-1.5">
            <Label>Merchant Name *</Label>
            <Input
              placeholder="e.g. Shoprite Lekki"
              {...register('merchantName', { required: 'Merchant name is required' })}
              className={errors.merchantName ? 'border-red-500' : ''}
            />
            {errors.merchantName && <p className="text-xs text-red-500">{errors.merchantName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Transaction Type */}
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Controller
                name="type"
                control={control}
                rules={{ required: 'Type is required' }}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                      <SelectItem value="reversal">Reversal</SelectItem>
                      <SelectItem value="balance_inquiry">Balance Inquiry</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>Amount (₦) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 45000"
                {...register('amount', {
                  required: 'Amount is required',
                  valueAsNumber: true,
                  min: { value: 0.01, message: 'Must be > 0' },
                })}
                className={errors.amount ? 'border-red-500' : ''}
              />
              {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Card Scheme */}
            <div className="space-y-1.5">
              <Label>Card Scheme *</Label>
              <Controller
                name="cardScheme"
                control={control}
                rules={{ required: 'Card scheme is required' }}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.cardScheme ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select scheme..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Visa">Visa</SelectItem>
                      <SelectItem value="Mastercard">Mastercard</SelectItem>
                      <SelectItem value="Verve">Verve</SelectItem>
                      <SelectItem value="Amex">Amex</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cardScheme && <p className="text-xs text-red-500">{errors.cardScheme.message}</p>}
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? 'NGN'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Response Code */}
            <div className="space-y-1.5">
              <Label>Response Code *</Label>
              <Input
                placeholder="e.g. 00"
                maxLength={4}
                {...register('responseCode', { required: 'Response code is required' })}
                className={errors.responseCode ? 'border-red-500' : ''}
              />
              {errors.responseCode && <p className="text-xs text-red-500">{errors.responseCode.message}</p>}
            </div>

            {/* RRN */}
            <div className="space-y-1.5">
              <Label>RRN *</Label>
              <Input
                placeholder="12-digit retrieval ref"
                maxLength={12}
                {...register('rrn', { required: 'RRN is required' })}
                className={errors.rrn ? 'border-red-500' : ''}
              />
              {errors.rrn && <p className="text-xs text-red-500">{errors.rrn.message}</p>}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? 'pending'} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reversed">Reversed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Transaction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Terminals Tab ───────────────────────────────────────────────────────────

function TerminalsTab({ terminals, isLoading, isError, refetch }: {
  terminals: POSTerminal[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<POSTerminalStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<POSTerminal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(terminals.map((t) => t.category));
    return Array.from(set).sort();
  }, [terminals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return terminals.filter((t) => {
      const matchSearch =
        !q ||
        t.terminalId.toLowerCase().includes(q) ||
        t.merchantName.toLowerCase().includes(q) ||
        t.merchantId.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.state.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [terminals, search, statusFilter, categoryFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search || statusFilter !== 'all' || categoryFilter !== 'all';

  function clearFilters() {
    setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by terminal ID, merchant, location, state..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as POSTerminalStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-36">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>

          {categories.length > 1 && (
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}

          <Button onClick={() => setDeployOpen(true)} className="ml-auto">
            <Plus className="h-4 w-4 mr-2" />
            Deploy Terminal
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Terminal ID</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Daily Txns</TableHead>
              <TableHead className="text-right">Daily Volume</TableHead>
              <TableHead className="text-right">Monthly Volume</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead>Last Txn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={12} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={12} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TriangleAlert className="h-8 w-8 text-red-400" />
                    <p className="font-medium">Failed to load POS terminals</p>
                    <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Smartphone className="h-8 w-8" />
                    <p className="font-medium">
                      {hasFilters ? 'No terminals match your filters' : 'No POS terminals found'}
                    </p>
                    {hasFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelected(t); setSheetOpen(true); }}
                >
                  <TableCell className="font-mono text-sm font-medium">{t.terminalId}</TableCell>
                  <TableCell className="max-w-[160px]">
                    <div className="truncate font-medium">{t.merchantName}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.merchantId}</div>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">{t.location}</TableCell>
                  <TableCell>{t.state}</TableCell>
                  <TableCell>{capitalize(t.category)}</TableCell>
                  <TableCell className="text-sm">{t.model}</TableCell>
                  <TableCell><TerminalStatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{t.dailyTransactionCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurrency(t.dailyVolume)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurrency(t.monthlyVolume)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.commissionRate}%</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(t.lastTransaction)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <TerminalDetailSheet
        terminal={selected}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />

      <DeployTerminalDialog
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
      />
    </div>
  );
}

// ─── Transactions Tab ────────────────────────────────────────────────────────

function TransactionsTab({ terminals, isLoading, isError, refetch }: {
  terminals: POSTerminal[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}) {
  const { data: txnData } = usePosTransactions();
  const transactions = txnData?.items ?? [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<POSTransactionStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [recordOpen, setRecordOpen] = useState(false);

  const schemes = useMemo(() => {
    const set = new Set(transactions.map((t) => t.cardScheme));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const matchSearch =
        !q ||
        t.terminalId.toLowerCase().includes(q) ||
        t.merchantName.toLowerCase().includes(q) ||
        t.rrn.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchType = typeFilter === 'all' || t.type === typeFilter;
      const matchScheme = schemeFilter === 'all' || t.cardScheme === schemeFilter;
      return matchSearch && matchStatus && matchType && matchScheme;
    });
  }, [transactions, search, statusFilter, typeFilter, schemeFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all' || schemeFilter !== 'all';

  function clearFilters() {
    setSearch(''); setStatusFilter('all'); setTypeFilter('all'); setSchemeFilter('all'); setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by terminal ID, merchant, RRN, transaction ID..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as POSTransactionStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-36">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="reversal">Reversal</SelectItem>
              <SelectItem value="balance_inquiry">Balance Inquiry</SelectItem>
            </SelectContent>
          </Select>

          {schemes.length > 1 && (
            <Select value={schemeFilter} onValueChange={(v) => { setSchemeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Card Scheme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schemes</SelectItem>
                {schemes.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}

          <Button onClick={() => setRecordOpen(true)} className="ml-auto">
            <Plus className="h-4 w-4 mr-2" />
            Record Transaction
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Terminal ID</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Card Scheme</TableHead>
              <TableHead>Response Code</TableHead>
              <TableHead>RRN</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={10} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TriangleAlert className="h-8 w-8 text-red-400" />
                    <p className="font-medium">Failed to load transactions</p>
                    <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Activity className="h-8 w-8" />
                    <p className="font-medium">
                      {hasFilters ? 'No transactions match your filters' : 'No transactions found'}
                    </p>
                    {hasFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-mono text-sm">{txn.terminalId}</TableCell>
                  <TableCell className="max-w-[140px] truncate">{txn.merchantName}</TableCell>
                  <TableCell><TxnTypeBadge type={txn.type} /></TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmtCurrency(txn.amount)}
                  </TableCell>
                  <TableCell>{txn.currency}</TableCell>
                  <TableCell><CardSchemeBadge scheme={txn.cardScheme} /></TableCell>
                  <TableCell className="font-mono text-sm">
                    <span className={txn.responseCode === '00' ? 'text-emerald-600' : 'text-red-600'}>
                      {txn.responseCode}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{txn.rrn}</TableCell>
                  <TableCell><TxnStatusBadge status={txn.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {fmtDate(txn.timestamp)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <RecordTransactionDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        terminals={terminals}
      />
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function POSTerminalWorkspace() {
  const {
    data: terminalsData,
    isLoading: terminalsLoading,
    isError: terminalsError,
    refetch: refetchTerminals,
  } = usePosTerminals();

  const {
    data: txnData,
    isLoading: txnLoading,
    isError: txnError,
    refetch: refetchTxns,
  } = usePosTransactions();

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = usePosStats();

  const terminals = terminalsData?.items ?? [];

  const approvalRate = stats
    ? stats.dailyTransactions > 0
      ? `${((stats.approvedTxns / stats.dailyTransactions) * 100).toFixed(1)}%`
      : '—'
    : '—';

  function refetchAll() {
    refetchTerminals();
    refetchTxns();
    refetchStats();
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 rounded-lg">
              <Smartphone className="h-5 w-5 text-teal-700" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">POS Terminal Management</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Merchant terminals — transaction volumes, card schemes and commissions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={terminalsLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${terminalsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Terminals"
          value={stats?.totalTerminals ?? '—'}
          icon={<Smartphone className="h-5 w-5 text-teal-600" />}
          iconBg="bg-teal-50"
          loading={statsLoading}
        />
        <StatCard
          title="Daily Transactions"
          value={stats ? stats.dailyTransactions.toLocaleString() : '—'}
          icon={<Activity className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          loading={statsLoading}
        />
        <StatCard
          title="Daily Volume"
          value={stats ? fmtCurrency(stats.dailyVolume) : '—'}
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          loading={statsLoading}
        />
        <StatCard
          title="Approved"
          value={stats ? stats.approvedTxns.toLocaleString() : '—'}
          icon={<ThumbsUp className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          sub={approvalRate !== '—' ? `${approvalRate} approval rate` : undefined}
          loading={statsLoading}
        />
        <StatCard
          title="Declined"
          value={stats ? stats.declinedTxns.toLocaleString() : '—'}
          icon={<ThumbsDown className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          loading={statsLoading}
        />
      </div>

      {/* Breakdown strips */}
      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {/* By status */}
          {Object.keys(stats.byStatus).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">By status:</span>
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <TerminalStatusBadge status={status as POSTerminalStatus} />
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* By category */}
          {Object.keys(stats.byCategory).length > 0 && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" /> By category:
                </span>
                {Object.entries(stats.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <Badge key={cat} variant="secondary" className="text-xs">
                      {capitalize(cat)}: {count}
                    </Badge>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="terminals">
        <TabsList>
          <TabsTrigger value="terminals" className="gap-2">
            <Smartphone className="h-4 w-4" />
            Terminals
            {terminalsData && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {terminalsData.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Transactions
            {txnData && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {txnData.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terminals" className="mt-4">
          <TerminalsTab
            terminals={terminals}
            isLoading={terminalsLoading}
            isError={terminalsError}
            refetch={refetchTerminals}
          />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab
            terminals={terminals}
            isLoading={txnLoading}
            isError={txnError}
            refetch={refetchTxns}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
