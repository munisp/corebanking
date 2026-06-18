import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Activity,
  AlertTriangle,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import { useAtmTerminals, useAtmFaults, useAtmStats, useReportFault, useCreateAtmTerminal } from '@/hooks/useAtm';
import type { ATMTerminal, ATMFault, ATMStatus, FaultSeverity, FaultStatus, ReportFaultPayload, CreateATMPayload } from '@/types/atm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function fmtCurrency(n: number | undefined | null) {
  const val = n ?? 0;
  if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `₦${(val / 1_000).toFixed(0)}K`;
  return `₦${val.toLocaleString()}`;
}

function fmtDate(s?: string) {
  if (!s) return '—';
  try {
    return format(parseISO(s), 'dd MMM yyyy, HH:mm');
  } catch {
    return s;
  }
}

// ─── Status & severity badges ────────────────────────────────────────────────

function ATMStatusBadge({ status }: { status: ATMStatus }) {
  const map: Record<ATMStatus, { label: string; className: string }> = {
    online:      { label: 'Online',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    offline:     { label: 'Offline',     className: 'bg-red-100 text-red-700 border-red-200' },
    low_cash:    { label: 'Low Cash',    className: 'bg-amber-100 text-amber-700 border-amber-200' },
    maintenance: { label: 'Maintenance', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: FaultSeverity }) {
  const map: Record<FaultSeverity, { label: string; className: string }> = {
    critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200' },
    high:     { label: 'High',     className: 'bg-orange-100 text-orange-700 border-orange-200' },
    medium:   { label: 'Medium',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
    low:      { label: 'Low',      className: 'bg-sky-100 text-sky-700 border-sky-200' },
  };
  const cfg = map[severity] ?? { label: severity, className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function FaultStatusBadge({ status }: { status: FaultStatus }) {
  const map: Record<FaultStatus, { label: string; className: string }> = {
    open:        { label: 'Open',        className: 'bg-red-100 text-red-700 border-red-200' },
    in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    resolved:    { label: 'Resolved',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
}

function StatCard({ title, value, icon, iconBg, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-24 mt-1" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
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
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Pagination controls ─────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}

function Pagination({ page, total, pageSize, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-2">{page} / {totalPages}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── ATM Detail Sheet ────────────────────────────────────────────────────────

function ATMDetailSheet({
  atm,
  open,
  onClose,
}: {
  atm: ATMTerminal | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!atm) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {atm.terminalId}
          </SheetTitle>
          <SheetDescription>{atm.location} · {atm.branch}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6 pr-4">
            {/* Status & type */}
            <div className="flex items-center gap-3">
              <ATMStatusBadge status={atm.status} />
              <Badge variant="secondary" className="text-xs">{atm.type}</Badge>
            </div>

            {/* Cash level */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cash Level</span>
                <span className="font-medium">{atm.cashLevel}%</span>
              </div>
              <Progress
                value={atm.cashLevel}
                className={
                  atm.cashLevel <= 20
                    ? '[&>div]:bg-red-500'
                    : atm.cashLevel <= 40
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-emerald-500'
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{fmtCurrency(atm.cashBalance)} available</span>
                <span>Max {fmtCurrency(atm.maxCapacity)}</span>
              </div>
            </div>

            <Separator />

            {/* Location info */}
            <div className="grid grid-cols-2 gap-4">
              <Detail label="State" value={atm.state} />
              <Detail label="Branch" value={atm.branch} />
              <Detail label="Location" value={atm.location} />
              <Detail label="Type" value={atm.type} />
            </div>

            <Separator />

            {/* Performance */}
            <div>
              <p className="text-sm font-medium mb-3">Performance</p>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Daily Transactions" value={atm.dailyTransactions.toLocaleString()} />
                <Detail label="Daily Volume" value={fmtCurrency(atm.dailyVolume)} />
                <Detail label="Uptime (30d)" value={`${atm.uptime30d}%`} />
              </div>
            </div>

            <Separator />

            {/* Replenishment */}
            <div>
              <p className="text-sm font-medium mb-3">Replenishment</p>
              <div className="space-y-3">
                <Detail label="Last Replenishment" value={fmtDate(atm.lastReplenishment)} />
                <Detail label="Next Replenishment" value={fmtDate(atm.nextReplenishment)} />
              </div>
            </div>

            {/* Fault info (if any) */}
            {atm.lastFault && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-3 text-amber-600 flex items-center gap-1">
                    <TriangleAlert className="h-4 w-4" /> Last Fault
                  </p>
                  <div className="space-y-3">
                    <Detail label="Reported At" value={fmtDate(atm.lastFault)} />
                    {atm.faultType && <Detail label="Fault Type" value={atm.faultType} />}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ─── Add ATM Dialog ──────────────────────────────────────────────────────────

const ATM_TYPES = ['ATM', 'CDM', 'KIOSK', 'MPOS'];

interface AddATMForm {
  terminalId: string;
  location: string;
  branch: string;
  state: string;
  type: string;
  status: ATMStatus | '';
  cashBalance: string;
  maxCapacity: string;
}

function AddATMDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: createATM, isPending } = useCreateAtmTerminal();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddATMForm>({
    defaultValues: {
      terminalId: '', location: '', branch: '', state: '',
      type: '', status: '', cashBalance: '', maxCapacity: '',
    },
  });

  const selectedType = watch('type');
  const selectedStatus = watch('status');

  function onSubmit(data: AddATMForm) {
    const payload: CreateATMPayload = {
      terminalId: data.terminalId.trim(),
      location:   data.location.trim(),
      branch:     data.branch.trim(),
      state:      data.state.trim(),
      type:       data.type,
      ...(data.status     && { status:      data.status as ATMStatus }),
      ...(data.cashBalance && { cashBalance: Number(data.cashBalance) }),
      ...(data.maxCapacity && { maxCapacity: Number(data.maxCapacity) }),
    };
    createATM(payload, { onSuccess: () => { reset(); onClose(); } });
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-500" />
            Add ATM Terminal
          </DialogTitle>
          <DialogDescription>
            Register a new ATM terminal. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Terminal ID *</Label>
              <Input
                placeholder="e.g. TRM-001234"
                {...register('terminalId', { required: 'Terminal ID is required' })}
                className={errors.terminalId ? 'border-red-500' : ''}
              />
              {errors.terminalId && (
                <p className="text-xs text-red-500">{errors.terminalId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={selectedType} onValueChange={(v) => setValue('type', v, { shouldValidate: true })}>
                <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {ATM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <input type="hidden" {...register('type', { required: 'Type is required' })} />
              {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Location *</Label>
            <Input
              placeholder="e.g. Marina Branch, Lagos"
              {...register('location', { required: 'Location is required' })}
              className={errors.location ? 'border-red-500' : ''}
            />
            {errors.location && <p className="text-xs text-red-500">{errors.location.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Branch *</Label>
              <Input
                placeholder="e.g. Marina"
                {...register('branch', { required: 'Branch is required' })}
                className={errors.branch ? 'border-red-500' : ''}
              />
              {errors.branch && <p className="text-xs text-red-500">{errors.branch.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>State *</Label>
              <Input
                placeholder="e.g. Lagos"
                {...register('state', { required: 'State is required' })}
                className={errors.state ? 'border-red-500' : ''}
              />
              {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Initial Status</Label>
            <Select value={selectedStatus} onValueChange={(v) => setValue('status', v as ATMStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Default: Online" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="low_cash">Low Cash</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cash Balance (₦)</Label>
              <Input type="number" placeholder="e.g. 2500000" {...register('cashBalance')} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Capacity (₦)</Label>
              <Input type="number" placeholder="e.g. 10000000" {...register('maxCapacity')} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add ATM
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Fault Dialog ─────────────────────────────────────────────────────

interface ReportFaultForm {
  atmId: string;
  terminalId: string;
  faultType: string;
  severity: FaultSeverity | '';
  description: string;
  status: FaultStatus | '';
}

const FAULT_TYPES = [
  'Card Reader Error',
  'Cash Dispenser Jam',
  'Network Connectivity',
  'Power Failure',
  'Receipt Printer Error',
  'Screen Malfunction',
  'Keypad Error',
  'Software Crash',
  'Cash Cassette Empty',
  'Other',
];

function ReportFaultDialog({
  open,
  onClose,
  terminals,
}: {
  open: boolean;
  onClose: () => void;
  terminals: ATMTerminal[];
}) {
  const { mutate: reportFault, isPending } = useReportFault();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReportFaultForm>({
    defaultValues: {
      atmId: '',
      terminalId: '',
      faultType: '',
      severity: '',
      description: '',
      status: '',
    },
  });

  const selectedAtmId = watch('atmId');

  function handleAtmSelect(atmId: string) {
    setValue('atmId', atmId, { shouldValidate: true });
    const terminal = terminals.find((t) => t.id === atmId);
    setValue('terminalId', terminal?.terminalId ?? '');
  }

  function onSubmit(data: ReportFaultForm) {
    const payload: ReportFaultPayload = {
      atmId: data.atmId,
      faultType: data.faultType,
      ...(data.terminalId && { terminalId: data.terminalId }),
      ...(data.severity && { severity: data.severity }),
      ...(data.description.trim() && { description: data.description.trim() }),
      ...(data.status && { status: data.status }),
    };

    reportFault(payload, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report ATM Fault
          </DialogTitle>
          <DialogDescription>
            Log a new fault for an ATM terminal. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* ATM selection */}
          <div className="space-y-1.5">
            <Label>ATM Terminal *</Label>
            <Select value={selectedAtmId} onValueChange={handleAtmSelect}>
              <SelectTrigger className={errors.atmId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select terminal..." />
              </SelectTrigger>
              <SelectContent>
                {terminals.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.terminalId} — {t.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* hidden input for validation */}
            <input
              type="hidden"
              {...register('atmId', { required: 'ATM is required' })}
            />
            {errors.atmId && (
              <p className="text-xs text-red-500">{errors.atmId.message}</p>
            )}
          </div>

          {/* Fault type */}
          <div className="space-y-1.5">
            <Label>Fault Type *</Label>
            <Select
              onValueChange={(v) => setValue('faultType', v, { shouldValidate: true })}
            >
              <SelectTrigger className={errors.faultType ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select fault type..." />
              </SelectTrigger>
              <SelectContent>
                {FAULT_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              {...register('faultType', { required: 'Fault type is required' })}
            />
            {errors.faultType && (
              <p className="text-xs text-red-500">{errors.faultType.message}</p>
            )}
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select onValueChange={(v) => setValue('severity', v as FaultSeverity)}>
              <SelectTrigger>
                <SelectValue placeholder="Select severity..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Initial Status</Label>
            <Select onValueChange={(v) => setValue('status', v as FaultStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the fault in detail..."
              rows={3}
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Report Fault
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Terminals Tab ───────────────────────────────────────────────────────────

function TerminalsTab({ terminals, isLoading, isError, refetch }: {
  terminals: ATMTerminal[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ATMStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedAtm, setSelectedAtm] = useState<ATMTerminal | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const types = useMemo(() => {
    const set = new Set(terminals.map((t) => t.type));
    return Array.from(set).sort();
  }, [terminals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return terminals.filter((t) => {
      const matchSearch =
        !q ||
        t.terminalId.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.branch.toLowerCase().includes(q) ||
        t.state.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchType = typeFilter === 'all' || t.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [terminals, search, statusFilter, typeFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openDetail(atm: ATMTerminal) {
    setSelectedAtm(atm);
    setSheetOpen(true);
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setPage(1);
  }

  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by terminal ID, location, branch, state..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ATMStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-36">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="low_cash">Low Cash</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>

          {types.length > 1 && (
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Terminal ID</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cash Level</TableHead>
              <TableHead className="text-right">Cash Balance</TableHead>
              <TableHead className="text-right">Daily Txns</TableHead>
              <TableHead className="text-right">Uptime 30d</TableHead>
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
                    <p className="font-medium">Failed to load ATM terminals</p>
                    <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-8 w-8" />
                    <p className="font-medium">
                      {hasFilters ? 'No terminals match your filters' : 'No ATM terminals found'}
                    </p>
                    {hasFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((atm) => (
                <TableRow
                  key={atm.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(atm)}
                >
                  <TableCell className="font-mono text-sm font-medium">{atm.terminalId}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{atm.location}</TableCell>
                  <TableCell>{atm.branch}</TableCell>
                  <TableCell>{atm.state}</TableCell>
                  <TableCell>{atm.type}</TableCell>
                  <TableCell><ATMStatusBadge status={atm.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Progress
                        value={atm.cashLevel}
                        className={`w-16 h-2 ${
                          atm.cashLevel <= 20
                            ? '[&>div]:bg-red-500'
                            : atm.cashLevel <= 40
                            ? '[&>div]:bg-amber-500'
                            : '[&>div]:bg-emerald-500'
                        }`}
                      />
                      <span className="text-xs tabular-nums">{atm.cashLevel}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurrency(atm.cashBalance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{atm.dailyTransactions.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{atm.uptime30d}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Pagination
          page={page}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </div>

      <ATMDetailSheet
        atm={selectedAtm}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

// ─── Faults Tab ──────────────────────────────────────────────────────────────

function FaultsTab({ faults, terminals, isLoading, isError, refetch }: {
  faults: ATMFault[];
  terminals: ATMTerminal[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FaultStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<FaultSeverity | 'all'>('all');
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return faults.filter((f) => {
      const matchSearch =
        !q ||
        f.atmId.toLowerCase().includes(q) ||
        f.terminalId.toLowerCase().includes(q) ||
        f.faultType.toLowerCase().includes(q) ||
        (f.engineer ?? '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || f.status === statusFilter;
      const matchSeverity = severityFilter === 'all' || f.severity === severityFilter;
      return matchSearch && matchStatus && matchSeverity;
    });
  }, [faults, search, statusFilter, severityFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = search || statusFilter !== 'all' || severityFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setSeverityFilter('all');
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ATM ID, terminal, fault type, engineer..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as FaultStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-36">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v as FaultSeverity | 'all'); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}

          <Button onClick={() => setReportOpen(true)} className="ml-auto">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Fault
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ATM ID</TableHead>
              <TableHead>Terminal</TableHead>
              <TableHead>Fault Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reported At</TableHead>
              <TableHead>Resolved At</TableHead>
              <TableHead>Engineer</TableHead>
              <TableHead className="text-right">MTTR (min)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={9} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TriangleAlert className="h-8 w-8 text-red-400" />
                    <p className="font-medium">Failed to load faults</p>
                    <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Activity className="h-8 w-8" />
                    <p className="font-medium">
                      {hasFilters ? 'No faults match your filters' : 'No faults recorded'}
                    </p>
                    {hasFilters ? (
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    ) : (
                      <Button size="sm" onClick={() => setReportOpen(true)}>
                        Report a fault
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((fault) => (
                <TableRow key={fault.id}>
                  <TableCell className="font-mono text-sm">{fault.atmId}</TableCell>
                  <TableCell className="font-mono text-sm">{fault.terminalId || '—'}</TableCell>
                  <TableCell>{fault.faultType}</TableCell>
                  <TableCell><SeverityBadge severity={fault.severity} /></TableCell>
                  <TableCell><FaultStatusBadge status={fault.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(fault.reportedAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(fault.resolvedAt)}</TableCell>
                  <TableCell>{fault.engineer || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fault.mttrMinutes != null ? fault.mttrMinutes.toLocaleString() : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Pagination
          page={page}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </div>

      <ReportFaultDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        terminals={terminals}
      />
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ATMManagementWorkspace() {
  const [addOpen, setAddOpen] = useState(false);

  const {
    data: terminalsData,
    isLoading: terminalsLoading,
    isError: terminalsError,
    refetch: refetchTerminals,
  } = useAtmTerminals();

  const {
    data: faultsData,
    isLoading: faultsLoading,
    isError: faultsError,
    refetch: refetchFaults,
  } = useAtmFaults();

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useAtmStats();

  const terminals = terminalsData?.items ?? [];
  const faults = faultsData?.items ?? [];

  function refetchAll() {
    refetchTerminals();
    refetchFaults();
    refetchStats();
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-slate-700" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">ATM Management</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cash levels, uptime monitoring, fault tracking and replenishment scheduling
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={terminalsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${terminalsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add ATM
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total ATMs"
          value={stats?.totalATMs ?? '—'}
          icon={<CreditCard className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-100"
          loading={statsLoading}
        />
        <StatCard
          title="Total Cash Holding"
          value={stats ? fmtCurrency(stats.totalCashHolding) : '—'}
          icon={<Banknote className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          loading={statsLoading}
        />
        <StatCard
          title="Daily Transactions"
          value={stats ? stats.dailyTransactions.toLocaleString() : '—'}
          icon={<Zap className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          loading={statsLoading}
        />
        <StatCard
          title="Open Faults"
          value={stats?.openFaults ?? '—'}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          loading={statsLoading}
        />
      </div>

      {/* Status breakdown */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">By status:</span>
          {(Object.entries(stats.byStatus) as [ATMStatus, number][]).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5">
              <ATMStatusBadge status={status} />
              <span className="text-sm font-medium">{count}</span>
            </div>
          ))}

          {Object.keys(stats.byState).length > 0 && (
            <>
              <Separator orientation="vertical" className="h-5 mx-1" />
              <span className="text-sm text-muted-foreground self-center flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Top states:
              </span>
              {Object.entries(stats.byState)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([state, count]) => (
                  <Badge key={state} variant="secondary" className="text-xs">
                    {state}: {count}
                  </Badge>
                ))}
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="terminals">
        <TabsList>
          <TabsTrigger value="terminals" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Terminals
            {terminalsData && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {terminalsData.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="faults" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Faults
            {faultsData && (
              <Badge
                variant="secondary"
                className={`ml-1 text-xs ${faultsData.total > 0 ? 'bg-red-100 text-red-700' : ''}`}
              >
                {faultsData.total}
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

        <TabsContent value="faults" className="mt-4">
          <FaultsTab
            faults={faults}
            terminals={terminals}
            isLoading={faultsLoading}
            isError={faultsError}
            refetch={refetchFaults}
          />
        </TabsContent>
      </Tabs>

      <AddATMDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
