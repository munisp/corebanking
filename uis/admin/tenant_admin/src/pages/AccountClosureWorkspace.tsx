import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardX,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
  XCircle,
} from 'lucide-react';

import {
  useAllAccounts,
  useAccountClosureList,
  useAccountClosureStats,
  useCreateClosureRequest,
  useApproveClosureRequest,
  useCompleteClosureRequest,
  useRejectClosureRequest,
} from '@/hooks/useAccount';
import type {
  AccountApplication,
  ClosureRequest,
  ClosureStatus,
  ClosureType,
  CreateClosureRequestPayload,
} from '@/types/account';

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
import { Textarea } from '@/components/ui/textarea';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const CLOSURE_TYPES: { value: ClosureType; label: string; description: string }[] = [
  { value: 'customer_request', label: 'Customer Request', description: 'Customer-initiated account closure' },
  { value: 'regulatory', label: 'Regulatory', description: 'Mandated by regulatory authority' },
  { value: 'dormancy', label: 'Dormancy', description: 'Account inactive for extended period' },
  { value: 'fraud', label: 'Fraud', description: 'Account flagged for fraudulent activity' },
  { value: 'deceased', label: 'Deceased', description: 'Account holder is deceased' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function fmtCurrency(n?: number) {
  if (n == null) return '—';
  return `₦${n.toLocaleString()}`;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function ClosureStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending:   { label: 'Pending',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
    in_review: { label: 'In Review', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    approved:  { label: 'Approved',  className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rejected:  { label: 'Rejected',  className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const cfg = map[status] ?? { label: capitalize(status), className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function ClosureTypeBadge({ type }: { type?: string }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    customer_request: 'bg-sky-100 text-sky-700 border-sky-200',
    regulatory:       'bg-purple-100 text-purple-700 border-purple-200',
    dormancy:         'bg-amber-100 text-amber-700 border-amber-200',
    fraud:            'bg-red-100 text-red-700 border-red-200',
    deceased:         'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {capitalize(type)}
    </Badge>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, icon, iconBg, loading }: {
  title: string; value: string | number; icon: React.ReactNode; iconBg: string; loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-lg shrink-0 ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? <Skeleton className="h-7 w-20 mt-1" /> : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

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

// ─── Pagination ───────────────────────────────────────────────────────────────

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

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function Detail({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

function ClosureDetailSheet({ request, open, onClose }: {
  request: ClosureRequest | null; open: boolean; onClose: () => void;
}) {
  const { mutate: approve, isPending: approving } = useApproveClosureRequest();
  const { mutate: complete, isPending: completing } = useCompleteClosureRequest();
  const { mutate: reject, isPending: rejecting } = useRejectClosureRequest();

  if (!request) return null;

  const actionPending = approving || completing || rejecting;
  const canApprove = request.status === 'pending' || request.status === 'in_review';
  const canComplete = request.status === 'approved';
  const canReject = request.status !== 'completed' && request.status !== 'rejected';

  function handleAction(fn: (id: string) => void) {
    fn(request!.id);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Closure Request
          </SheetTitle>
          <SheetDescription>ID: {request.id}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-180px)] mt-6">
          <div className="space-y-6 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <ClosureStatusBadge status={request.status} />
              <ClosureTypeBadge type={request.closureType} />
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">Account Details</p>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Account ID" value={request.accountId} />
                <Detail label="Account Name" value={request.accountName} />
                <Detail label="Account Type" value={request.accountType ? capitalize(request.accountType) : undefined} />
                <Detail label="Balance" value={fmtCurrency(request.balance)} />
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">Closure Details</p>
              <div className="space-y-3">
                <Detail label="Closure Type" value={request.closureType ? capitalize(request.closureType) : undefined} />
                <Detail label="Reason" value={request.reason} />
                <Detail label="Requested By" value={request.requestedBy} />
                <Detail label="Requested At" value={request.requestedAt} />
                <Detail label="Closed At" value={request.closedAt} />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="border-t pt-4 space-y-2 pr-4">
          {canApprove && (
            <Button
              className="w-full"
              variant="default"
              disabled={actionPending}
              onClick={() => handleAction(approve)}
            >
              {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve Request
            </Button>
          )}
          {canComplete && (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={actionPending}
              onClick={() => handleAction(complete)}
            >
              {completing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete Closure
            </Button>
          )}
          {canReject && (
            <Button
              className="w-full"
              variant="destructive"
              disabled={actionPending}
              onClick={() => handleAction(reject)}
            >
              {rejecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Request
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Request Closure Dialog ───────────────────────────────────────────────────

function RequestClosureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: createRequest, isPending } = useCreateClosureRequest();
  const { data: accounts = [] } = useAllAccounts();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateClosureRequestPayload>();

  const selectedAccountNumber = watch('accountId');

  function handleAccountSelect(accountNumber: string) {
    const acc = accounts.find((a) => a.account_number === accountNumber);
    setValue('accountId', accountNumber);
    if (acc) setValue('accountName', acc.name ?? '');
  }

  function onSubmit(data: CreateClosureRequestPayload) {
    createRequest(data, { onSuccess: () => { reset(); onClose(); } });
  }

  function handleClose() { reset(); onClose(); }

  const selectedAccount = accounts.find((a) => a.account_number === selectedAccountNumber);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Request Account Closure
          </DialogTitle>
          <DialogDescription>
            Select an account and provide closure details. All fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Account lookup */}
          <div className="space-y-1.5">
            <Label>Select Account *</Label>
            <Controller
              name="accountId"
              control={control}
              rules={{ required: 'Account is required' }}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => { handleAccountSelect(v); field.onChange(v); }}
                >
                  <SelectTrigger className={errors.accountId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Search accounts..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No accounts found</div>
                    ) : (
                      accounts.map((a) => (
                        <SelectItem key={a.account_number} value={a.account_number}>
                          <span className="font-medium">{a.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">{a.account_number}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.accountId && <p className="text-xs text-red-500">{errors.accountId.message}</p>}
          </div>

          {/* Account preview */}
          {selectedAccount && (
            <div className="bg-muted/40 rounded-md p-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Account No.</p>
                <p className="font-mono font-medium">{selectedAccount.account_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{selectedAccount.account_type ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currency</p>
                <p className="font-medium">{selectedAccount.account_currency as string ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="font-medium">
                  {selectedAccount.balance != null ? `₦${Number(selectedAccount.balance).toLocaleString()}` : '₦0'}
                </p>
              </div>
            </div>
          )}

          {/* Hidden account name (auto-populated) */}
          <input type="hidden" {...register('accountName')} />

          {/* Closure Type */}
          <div className="space-y-1.5">
            <Label>Closure Type *</Label>
            <Controller
              name="closureType"
              control={control}
              rules={{ required: 'Closure type is required' }}
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger className={errors.closureType ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select closure type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOSURE_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        <span className="font-medium">{ct.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{ct.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.closureType && <p className="text-xs text-red-500">{errors.closureType.message}</p>}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label>Reason *</Label>
            <Textarea
              placeholder="Provide a detailed reason for closure..."
              rows={3}
              {...register('reason', { required: 'Reason is required', minLength: { value: 10, message: 'Minimum 10 characters' } })}
              className={errors.reason ? 'border-red-500' : ''}
            />
            {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
          </div>

          {/* Requested By */}
          <div className="space-y-1.5">
            <Label>Requested By</Label>
            <Input placeholder="e.g. Branch Manager / Staff ID" {...register('requestedBy')} />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
            <strong>Warning:</strong> Closure triggers a regulated balance sweep and CBN notification. Ensure all due diligence is complete.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Closure Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountClosureWorkspace() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClosureStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ClosureType | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ClosureRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useAccountClosureList(page, PAGE_SIZE);
  const { data: stats, isLoading: statsLoading } = useAccountClosureStats();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((r) => {
      const matchSearch =
        !q ||
        (r.accountId ?? '').toLowerCase().includes(q) ||
        (r.accountName ?? '').toLowerCase().includes(q) ||
        (r.id ?? '').toLowerCase().includes(q) ||
        (r.requestedBy ?? '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchType = typeFilter === 'all' || r.closureType === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [items, search, statusFilter, typeFilter]);

  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all';

  function clearFilters() { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Account Closure</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Regulated account closure workflow with balance sweep and CBN notification
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Request Closure
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={stats?.total ?? total}
          icon={<ClipboardX className="h-5 w-5 text-slate-600" />}
          iconBg="bg-slate-100"
          loading={statsLoading}
        />
        <StatCard
          title="Pending / In Review"
          value={items.filter((r) => r.status === 'pending' || r.status === 'in_review').length}
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
          loading={isLoading}
        />
        <StatCard
          title="Completed"
          value={items.filter((r) => r.status === 'completed').length}
          icon={<XCircle className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          loading={isLoading}
        />
        <StatCard
          title="Rejected"
          value={items.filter((r) => r.status === 'rejected').length}
          icon={<TriangleAlert className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          loading={isLoading}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by account ID, name, request ID, requested by..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ClosureStatus | 'all')}>
            <SelectTrigger className="w-40">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ClosureType | 'all')}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Closure Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CLOSURE_TYPES.map((ct) => (
                <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              <TableHead>Request ID</TableHead>
              <TableHead>Account ID</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Closure Type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton cols={8} />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TriangleAlert className="h-8 w-8 text-red-400" />
                    <p className="font-medium">Failed to load closure requests</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <XCircle className="h-8 w-8" />
                    <p className="font-medium">
                      {hasFilters ? 'No requests match your filters' : 'No closure requests yet'}
                    </p>
                    {hasFilters ? (
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    ) : (
                      <Button variant="destructive" size="sm" onClick={() => setDialogOpen(true)}>
                        Submit first request
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelectedRequest(req); setSheetOpen(true); }}
                >
                  <TableCell className="font-mono text-xs">{req.id}</TableCell>
                  <TableCell className="font-mono text-sm">{req.accountId ?? '—'}</TableCell>
                  <TableCell className="font-medium">{req.accountName ?? '—'}</TableCell>
                  <TableCell><ClosureTypeBadge type={req.closureType} /></TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {req.reason ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurrency(req.balance)}</TableCell>
                  <TableCell className="text-sm">{req.requestedBy ?? '—'}</TableCell>
                  <TableCell><ClosureStatusBadge status={req.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination page={page} total={hasFilters ? filtered.length : total} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      <ClosureDetailSheet request={selectedRequest} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <RequestClosureDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
