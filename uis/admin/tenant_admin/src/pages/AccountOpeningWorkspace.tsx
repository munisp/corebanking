import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardX,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';

import {
  useAccountList,
  useAccountOpeningStats,
  useCreateAccountApplication,
  useAccountClosureList,
  useAccountClosureStats,
  useCreateClosureRequest,
  useApproveClosureRequest,
  useCompleteClosureRequest,
  useRejectClosureRequest,
  useAllAccounts,
} from '@/hooks/useAccount';
import type {
  AccountApplication,
  ApplicationStatus,
  AccountProductType,
  AccountCurrencyType,
  AccountTier,
  CreateAccountApplicationPayload,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const PRODUCT_TYPES: AccountProductType[] = ['primary', 'savings', 'current'];
const CURRENCIES: AccountCurrencyType[] = ['NGN', 'USD', 'EUR', 'GBP', 'GHS'];
const TIERS: AccountTier[] = ['tier1', 'tier2', 'tier3'];

const TIER_LIMITS: Record<AccountTier, string> = {
  tier1: '₦50,000 daily — basic KYC',
  tier2: '₦200,000 daily — BVN required',
  tier3: '₦5,000,000 daily — full KYC required',
};

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

// ─── Shared UI ───────────────────────────────────────────────────────────────

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

function Detail({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function AccountStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:    { label: 'Active',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    inactive:  { label: 'Inactive',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
    suspended: { label: 'Suspended', className: 'bg-red-100 text-red-700 border-red-200' },
    deleted:   { label: 'Deleted',   className: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const cfg = map[status] ?? { label: capitalize(status), className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

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

// ─── Account detail sheet ──────────────────────────────────────────────────────

function AccountDetailSheet({ app, open, onClose }: {
  app: AccountApplication | null; open: boolean; onClose: () => void;
}) {
  if (!app) return null;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal-600" />
            {app.name}
          </SheetTitle>
          <SheetDescription>Account ID: {app.id}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <AccountStatusBadge status={app.status} />
              {app.account_type && (
                <Badge variant="secondary" className="text-xs">{capitalize(app.account_type)}</Badge>
              )}
              {app.tier && (
                <Badge variant="outline" className="text-xs">{String(app.tier).toUpperCase()}</Badge>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">Account Details</p>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Account Name" value={app.name} />
                <Detail label="Account Number" value={app.account_number} />
                <Detail label="Account Type" value={app.account_type ? capitalize(app.account_type) : undefined} />
                <Detail label="Currency" value={app.account_currency as string} />
                <Detail label="Tier" value={app.tier ? String(app.tier).toUpperCase() : undefined} />
                <Detail label="Balance" value={app.balance != null ? `₦${Number(app.balance).toLocaleString()}` : '₦0'} />
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-3">System Info</p>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Keycloak ID" value={app.keycloak_id as string} />
                <Detail label="Ledger ID" value={app.ledger_id as string} />
                <Detail label="Created" value={app.created_at as string} />
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── Closure detail sheet ──────────────────────────────────────────────────────

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
        <div className="border-t pt-4 space-y-2 pr-4">
          {canApprove && (
            <Button className="w-full" variant="default" disabled={actionPending} onClick={() => approve(request.id)}>
              {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve Request
            </Button>
          )}
          {canComplete && (
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={actionPending} onClick={() => complete(request.id)}>
              {completing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete Closure
            </Button>
          )}
          {canReject && (
            <Button className="w-full" variant="destructive" disabled={actionPending} onClick={() => reject(request.id)}>
              {rejecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject Request
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── New Account Dialog ───────────────────────────────────────────────────────

function NewAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: createApp, isPending } = useCreateAccountApplication();
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateAccountApplicationPayload>({
    defaultValues: { account_type: 'savings', account_currency: 'NGN', tier: 'tier1' },
  });

  const selectedTier = watch('tier');

  function onSubmit(data: CreateAccountApplicationPayload) {
    createApp(data, { onSuccess: () => { reset(); onClose(); } });
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal-600" />
            Create New Account
          </DialogTitle>
          <DialogDescription>
            Open a new bank account. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Account Name *</Label>
            <Input
              placeholder="e.g. Fatima Abdullahi"
              {...register('name', { required: 'Account name is required' })}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Account Type *</Label>
              <Controller
                name="account_type"
                control={control}
                rules={{ required: 'Account type is required' }}
                render={({ field }) => (
                  <Select value={field.value ?? 'savings'} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.account_type ? 'border-red-500' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.account_type && <p className="text-xs text-red-500">{errors.account_type.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Controller
                name="account_currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? 'NGN'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Account Tier</Label>
            <Controller
              name="tier"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? 'tier1'} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {selectedTier && (
              <p className="text-xs text-muted-foreground">{TIER_LIMITS[selectedTier as AccountTier]}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
  const selectedAccount = accounts.find((a) => a.account_number === selectedAccountNumber);

  function handleAccountSelect(accountNumber: string) {
    const acc = accounts.find((a) => a.account_number === accountNumber);
    setValue('accountId', accountNumber);
    if (acc) setValue('accountName', acc.name ?? '');
  }

  function onSubmit(data: CreateClosureRequestPayload) {
    createRequest(data, { onSuccess: () => { reset(); onClose(); } });
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Request Account Closure
          </DialogTitle>
          <DialogDescription>
            Select an account and provide closure details. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
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
          <input type="hidden" {...register('accountName')} />
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

export default function AccountOpeningWorkspace() {
  // Accounts tab
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AccountProductType | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<AccountTier | 'all'>('all');
  const [selectedApp, setSelectedApp] = useState<AccountApplication | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Closures tab
  const [closurePage, setClosurePage] = useState(1);
  const [closureSearch, setClosureSearch] = useState('');
  const [closureStatusFilter, setClosureStatusFilter] = useState<ClosureStatus | 'all'>('all');
  const [closureTypeFilter, setClosureTypeFilter] = useState<ClosureType | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ClosureRequest | null>(null);
  const [closureSheetOpen, setClosureSheetOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useAccountList(page, PAGE_SIZE);
  const { data: stats, isLoading: statsLoading } = useAccountOpeningStats();
  const { data: closureData, isLoading: closureLoading, isError: closureError, refetch: refetchClosures } = useAccountClosureList(closurePage, PAGE_SIZE);
  const { data: closureStats, isLoading: closureStatsLoading } = useAccountClosureStats();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const closureItems = closureData?.items ?? [];
  const closureTotal = closureData?.total ?? 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((a) => {
      const matchSearch =
        !q ||
        (a.name ?? '').toLowerCase().includes(q) ||
        (a.account_number ?? '').includes(q) ||
        String(a.id).toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchType = typeFilter === 'all' || a.account_type === typeFilter;
      const matchTier = tierFilter === 'all' || a.tier === tierFilter;
      return matchSearch && matchStatus && matchType && matchTier;
    });
  }, [items, search, statusFilter, typeFilter, tierFilter]);

  const filteredClosures = useMemo(() => {
    const q = closureSearch.toLowerCase();
    return closureItems.filter((r) => {
      const matchSearch =
        !q ||
        (r.accountId ?? '').toLowerCase().includes(q) ||
        (r.accountName ?? '').toLowerCase().includes(q) ||
        (r.id ?? '').toLowerCase().includes(q) ||
        (r.requestedBy ?? '').toLowerCase().includes(q);
      const matchStatus = closureStatusFilter === 'all' || r.status === closureStatusFilter;
      const matchType = closureTypeFilter === 'all' || r.closureType === closureTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [closureItems, closureSearch, closureStatusFilter, closureTypeFilter]);

  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all' || tierFilter !== 'all';
  const hasClosureFilters = closureSearch || closureStatusFilter !== 'all' || closureTypeFilter !== 'all';

  function clearFilters() { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); setTierFilter('all'); }
  function clearClosureFilters() { setClosureSearch(''); setClosureStatusFilter('all'); setClosureTypeFilter('all'); }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-50 rounded-lg">
            <UserPlus className="h-5 w-5 text-teal-700" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Account Management</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Create and manage customer accounts and closure requests
        </p>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="closures">Closures</TabsTrigger>
        </TabsList>

        {/* ── Accounts tab ─────────────────────────────────────────────────── */}
        <TabsContent value="accounts" className="space-y-6 mt-6">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Accounts"
              value={stats?.total ?? total}
              icon={<ClipboardList className="h-5 w-5 text-teal-600" />}
              iconBg="bg-teal-50"
              loading={statsLoading}
            />
            <StatCard
              title="Active"
              value={items.filter((a) => a.status === 'active').length}
              icon={<UserPlus className="h-5 w-5 text-emerald-600" />}
              iconBg="bg-emerald-50"
              loading={isLoading}
            />
            <StatCard
              title="Tier 1"
              value={items.filter((a) => a.tier === 'tier1').length}
              icon={<UserPlus className="h-5 w-5 text-blue-600" />}
              iconBg="bg-blue-50"
              loading={isLoading}
            />
            <StatCard
              title="Suspended"
              value={items.filter((a) => a.status === 'suspended').length}
              icon={<TriangleAlert className="h-5 w-5 text-red-500" />}
              iconBg="bg-red-50"
              loading={isLoading}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, account number, ID..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ApplicationStatus | 'all')}>
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
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as AccountProductType | 'all')}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as AccountTier | 'all')}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {TIERS.map((t) => (
                    <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Account No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
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
                        <p className="font-medium">Failed to load accounts</p>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ClipboardList className="h-8 w-8" />
                        <p className="font-medium">
                          {hasFilters ? 'No accounts match your filters' : 'No accounts yet'}
                        </p>
                        {hasFilters ? (
                          <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                        ) : (
                          <Button size="sm" onClick={() => setDialogOpen(true)}>Create first account</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((app) => (
                    <TableRow
                      key={app.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedApp(app); setSheetOpen(true); }}
                    >
                      <TableCell className="font-mono text-xs">{app.id}</TableCell>
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell className="font-mono text-sm">{app.account_number ?? '—'}</TableCell>
                      <TableCell>
                        {app.account_type
                          ? <Badge variant="secondary" className="text-xs">{capitalize(app.account_type)}</Badge>
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{app.account_currency as string ?? '—'}</TableCell>
                      <TableCell>
                        {app.tier
                          ? <Badge variant="outline" className="text-xs">{String(app.tier).toUpperCase()}</Badge>
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {app.balance != null ? `₦${Number(app.balance).toLocaleString()}` : '₦0'}
                      </TableCell>
                      <TableCell><AccountStatusBadge status={app.status} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Pagination page={page} total={hasFilters ? filtered.length : total} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        </TabsContent>

        {/* ── Closures tab ─────────────────────────────────────────────────── */}
        <TabsContent value="closures" className="space-y-6 mt-6">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchClosures()} disabled={closureLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${closureLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setClosureDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Request Closure
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Requests"
              value={closureStats?.total ?? closureTotal}
              icon={<ClipboardX className="h-5 w-5 text-slate-600" />}
              iconBg="bg-slate-100"
              loading={closureStatsLoading}
            />
            <StatCard
              title="Pending / In Review"
              value={closureItems.filter((r) => r.status === 'pending' || r.status === 'in_review').length}
              icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
              iconBg="bg-amber-50"
              loading={closureLoading}
            />
            <StatCard
              title="Completed"
              value={closureItems.filter((r) => r.status === 'completed').length}
              icon={<XCircle className="h-5 w-5 text-emerald-600" />}
              iconBg="bg-emerald-50"
              loading={closureLoading}
            />
            <StatCard
              title="Rejected"
              value={closureItems.filter((r) => r.status === 'rejected').length}
              icon={<TriangleAlert className="h-5 w-5 text-red-500" />}
              iconBg="bg-red-50"
              loading={closureLoading}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by account ID, name, request ID, requested by..."
                className="pl-9"
                value={closureSearch}
                onChange={(e) => setClosureSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={closureStatusFilter} onValueChange={(v) => setClosureStatusFilter(v as ClosureStatus | 'all')}>
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
              <Select value={closureTypeFilter} onValueChange={(v) => setClosureTypeFilter(v as ClosureType | 'all')}>
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
              {hasClosureFilters && (
                <Button variant="ghost" size="sm" onClick={clearClosureFilters} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

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
                {closureLoading ? (
                  <TableSkeleton cols={8} />
                ) : closureError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <TriangleAlert className="h-8 w-8 text-red-400" />
                        <p className="font-medium">Failed to load closure requests</p>
                        <Button variant="outline" size="sm" onClick={() => refetchClosures()}>Retry</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredClosures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <XCircle className="h-8 w-8" />
                        <p className="font-medium">
                          {hasClosureFilters ? 'No requests match your filters' : 'No closure requests yet'}
                        </p>
                        {hasClosureFilters ? (
                          <Button variant="outline" size="sm" onClick={clearClosureFilters}>Clear filters</Button>
                        ) : (
                          <Button variant="destructive" size="sm" onClick={() => setClosureDialogOpen(true)}>
                            Submit first request
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClosures.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedRequest(req); setClosureSheetOpen(true); }}
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
            <Pagination
              page={closurePage}
              total={hasClosureFilters ? filteredClosures.length : closureTotal}
              pageSize={PAGE_SIZE}
              onPage={setClosurePage}
            />
          </div>
        </TabsContent>
      </Tabs>

      <AccountDetailSheet app={selectedApp} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <NewAccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <ClosureDetailSheet request={selectedRequest} open={closureSheetOpen} onClose={() => setClosureSheetOpen(false)} />
      <RequestClosureDialog open={closureDialogOpen} onClose={() => setClosureDialogOpen(false)} />
    </div>
  );
}
