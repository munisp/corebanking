import { useState } from 'react';
import {
  Moon, Search, RefreshCw, ChevronRight, AlertTriangle,
  CheckCircle2, BellRing, RotateCcw, Info,
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useDormantAccountList,
  useDormancyStats,
  useCheckDormancy,
  useReactivateAccount,
  useNotifyAccount,
} from '../hooks/useDormancy';
import type {
  DormantAccount,
  DormancyStage,
  CheckDormancyResponse,
  RestrictionLevel,
} from '../types/dormancy';

// ── Config ────────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<DormancyStage, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  active:    { label: 'Active',    variant: 'secondary',    color: 'text-green-700 bg-green-50' },
  inactive:  { label: 'Inactive',  variant: 'outline',      color: 'text-amber-700 bg-amber-50' },
  dormant:   { label: 'Dormant',   variant: 'default',      color: 'text-orange-700 bg-orange-50' },
  unclaimed: { label: 'Unclaimed', variant: 'destructive',  color: 'text-red-700 bg-red-50' },
};

const RESTRICTION_LABELS: Record<RestrictionLevel, string> = {
  none:             'No restriction',
  alert_only:       'Alert only',
  debit_restricted: 'Debit restricted',
  fully_restricted: 'Fully restricted',
};

const REACTIVATION_LABELS: Record<string, string> = {
  id_verification:  'Identity verification',
  branch_visit:     'Branch visit',
  notarized_letter: 'Notarized letter',
  cbn_approval:     'CBN approval',
  online_kyc:       'Online KYC',
};

function fmt(n: number, currency = 'NGN') {
  return `${currency} ${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

// ── Check Dormancy Dialog ─────────────────────────────────────────────────────

function CheckDormancyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate, isPending, data, reset } = useCheckDormancy();
  const [mode, setMode] = useState<'account' | 'days'>('account');
  const [accountId, setAccountId] = useState('');
  const [days, setDays] = useState('');

  function submit() {
    if (mode === 'account' && accountId) mutate({ account_id: accountId });
    if (mode === 'days' && days) mutate({ last_txn_days: Number(days) });
  }

  function handleClose() {
    reset();
    setAccountId('');
    setDays('');
    onClose();
  }

  const result = data as CheckDormancyResponse | undefined;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-4 h-4" /> Check Dormancy Status
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'account' ? 'default' : 'outline'} onClick={() => setMode('account')}>By Account ID</Button>
            <Button size="sm" variant={mode === 'days' ? 'default' : 'outline'} onClick={() => setMode('days')}>By Days Inactive</Button>
          </div>
          {mode === 'account' ? (
            <div className="space-y-1.5">
              <Label>Account ID / Number</Label>
              <Input placeholder="DORM-0001 or account number" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Days Since Last Transaction</Label>
              <Input type="number" min={0} placeholder="e.g. 365" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          )}

          {result && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Stage</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${STAGE_CONFIG[result.dormancy_stage]?.color}`}>
                    {STAGE_CONFIG[result.dormancy_stage]?.label ?? result.dormancy_stage}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Restriction</p>
                  <p className="font-medium text-sm">{RESTRICTION_LABELS[result.restriction_level] ?? result.restriction_level}</p>
                </div>
                {result.days_inactive !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Days Inactive</p>
                    <p className="font-medium">{result.days_inactive}</p>
                  </div>
                )}
              </div>
              {result.reactivation_requirements.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reactivation Requirements</p>
                  <ul className="space-y-1">
                    {result.reactivation_requirements.map((r) => (
                      <li key={r} className="text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        {REACTIVATION_LABELS[r] ?? r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button onClick={submit} disabled={isPending || (mode === 'account' ? !accountId : !days)}>
            {isPending ? 'Checking…' : 'Check'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Account Detail Sheet ──────────────────────────────────────────────────────

function AccountDetailSheet({
  account, open, onClose,
}: {
  account: DormantAccount | null;
  open: boolean;
  onClose: () => void;
}) {
  const reactivate = useReactivateAccount();
  const notify = useNotifyAccount();
  const [notifyChannel, setNotifyChannel] = useState<'sms' | 'email' | 'letter'>('sms');

  if (!account) return null;

  const stageCfg = STAGE_CONFIG[account.dormancy_stage] ?? STAGE_CONFIG.inactive;
  const reqs = account.dormancy_stage === 'dormant'
    ? ['id_verification', 'branch_visit']
    : account.dormancy_stage === 'unclaimed'
    ? ['id_verification', 'branch_visit', 'notarized_letter', 'cbn_approval']
    : account.dormancy_stage === 'inactive'
    ? ['branch_visit']
    : [];

  function handleReactivate() {
    reactivate.mutate({ id: account!.id }, { onSuccess: onClose });
  }

  function handleNotify() {
    notify.mutate({ id: account!.id, channel: notifyChannel }, { onSuccess: onClose });
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-500" /> {account.account_name}
          </SheetTitle>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${stageCfg.color}`}>
              {stageCfg.label}
            </span>
            <Badge variant="outline" className="text-xs">{account.account_type.replace('_', ' ')}</Badge>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
          {([
            ['Account No', account.account_number],
            ['Customer ID', account.customer_id],
            ['Branch', account.branch],
            ['Balance', fmt(account.balance, account.currency)],
            ['Days Inactive', String(account.days_inactive)],
            ['Last Transaction', account.last_transaction_date],
            ['Restriction', RESTRICTION_LABELS[account.restriction_level] ?? account.restriction_level],
            ['Notifications Sent', String(account.notifications_sent)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="font-medium">{v}</p>
            </div>
          ))}
        </div>

        {account.flagged_for_cbn_sweep && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-xs text-red-700 font-medium">Flagged for CBN sweep — unclaimed for 10+ years</p>
          </div>
        )}

        {reqs.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground mb-2">Reactivation Requirements</p>
            <ul className="space-y-1.5">
              {reqs.map((r) => (
                <li key={r} className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {REACTIVATION_LABELS[r] ?? r}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {account.reactivation_eligible && (
            <Button
              className="w-full"
              onClick={handleReactivate}
              disabled={reactivate.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {reactivate.isPending ? 'Reactivating…' : 'Reactivate Account'}
            </Button>
          )}

          {!account.flagged_for_cbn_sweep && (
            <div className="flex gap-2">
              <Select value={notifyChannel} onValueChange={(v) => setNotifyChannel(v as typeof notifyChannel)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleNotify}
                disabled={notify.isPending}
              >
                <BellRing className="w-4 h-4 mr-2" />
                {notify.isPending ? 'Sending…' : 'Send Notice'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Workspace ────────────────────────────────────────────────────────────

export default function DormancyManagementWorkspace() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DormantAccount | null>(null);
  const [showCheck, setShowCheck] = useState(false);

  const { data: listData, isLoading, refetch } = useDormantAccountList({
    page, limit: 25,
    search: search || undefined,
    stage: stageFilter !== 'all' ? stageFilter : undefined,
  });
  const { data: stats, refetch: refetchStats } = useDormancyStats();

  function refetchAll() { refetch(); refetchStats(); }

  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Moon className="w-6 h-6 text-indigo-500" />
            Dormancy Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Account dormancy tracking, reactivation policies, and CBN regulatory compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCheck(true)}>
            <Info className="w-4 h-4 mr-2" /> Check Status
          </Button>
          <button onClick={refetchAll} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {([
            ['Total Tracked', stats.total, ''],
            ['Active', stats.active, 'text-green-600'],
            ['Inactive', stats.inactive, 'text-amber-600'],
            ['Dormant', stats.dormant, 'text-orange-600'],
            ['Unclaimed', stats.unclaimed, 'text-red-600'],
          ] as [string, number, string][]).map(([label, value, color]) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats && (stats.dormant > 0 || stats.unclaimed > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Dormant Balance</p>
              <p className="text-xl font-bold mt-1">{fmt(stats.total_dormant_balance)}</p>
            </CardContent>
          </Card>
          {stats.flagged_for_cbn_sweep > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Flagged for CBN Sweep</p>
                  <p className="text-xl font-bold mt-1 text-red-600">{stats.flagged_for_cbn_sweep}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Policy Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">CBN Dormancy Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Inactive Threshold', value: '> 180 days — alert only' },
              { label: 'Dormant Threshold', value: '> 365 days — debit restricted' },
              { label: 'Unclaimed Threshold', value: '> 10 years — CBN sweep eligible' },
              { label: 'Notification Trigger', value: '30 days before stage change' },
              { label: 'Reactivation Channel', value: 'Branch visit + KYC verification' },
              { label: 'Regulatory Framework', value: 'CBN BOFIA 2020 / AML Guidelines' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-medium mt-0.5 text-sm">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Dormant Accounts ({total})</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, account no, branch…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 w-56"
                />
              </div>
              <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All stages" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="dormant">Dormant</SelectItem>
                  <SelectItem value="unclaimed">Unclaimed</SelectItem>
                </SelectContent>
              </Select>
              {(search || stageFilter !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStageFilter('all'); setPage(1); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Notices</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading accounts…</TableCell></TableRow>
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No accounts found</TableCell></TableRow>
                )}
                {items.map((a) => {
                  const stageCfg = STAGE_CONFIG[a.dormancy_stage] ?? STAGE_CONFIG.inactive;
                  return (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(a)}>
                      <TableCell className="font-mono text-xs font-medium">{a.account_number}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{a.account_name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{a.account_type.replace('_', ' ')}</div>
                      </TableCell>
                      <TableCell className="text-sm">{a.branch}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{fmt(a.balance, a.currency)}</TableCell>
                      <TableCell className="text-right">
                        <span className={a.days_inactive > 365 ? 'text-orange-600 font-semibold' : a.days_inactive > 180 ? 'text-amber-600' : ''}>
                          {a.days_inactive}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${stageCfg.color}`}>
                          {stageCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{a.notifications_sent}</TableCell>
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {total > 25 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>Showing {Math.min((page - 1) * 25 + 1, total)}–{Math.min(page * 25, total)} of {total}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AccountDetailSheet
        account={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />

      <CheckDormancyDialog open={showCheck} onClose={() => setShowCheck(false)} />
    </div>
  );
}
