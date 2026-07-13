import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Banknote,
  ChevronRight,
  Landmark,
  Loader2,
  Plus,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  usePensionList,
  usePensionStats,
  useCreatePension,
  usePausePension,
  useResumePension,
  useWithdrawPension,
  usePensionContributions,
} from '../hooks/usePension';
import type {
  PensionAccount,
  PensionAccountType,
  PensionStatus,
  CreatePensionPayload,
} from '../types/pension';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PFAs = [
  'ARM Pension',
  'Stanbic IBTC Pension',
  'NLPC PFA',
  'Premium Pension Limited',
  'Leadway Pensure PFA',
  'AXA Mansard Pension',
  'Crusader Sterling Pensions',
  'Sigma Pensions',
  'Trustfund Pensions',
  'Other',
];

function fmt(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

const STATUS_CONFIG: Record<PensionStatus, { label: string; variant: 'default' | 'secondary' | 'outline'; cls: string }> = {
  active:    { label: 'Active',    variant: 'default',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inactive:  { label: 'Inactive',  variant: 'secondary', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  withdrawn: { label: 'Withdrawn', variant: 'outline',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// ─── Register Account Dialog ──────────────────────────────────────────────────

interface RegisterForm {
  customer_name: string;
  account_type: PensionAccountType | '';
  pfa: string;
  rsa_number: string;
  currency: string;
  status: PensionStatus | '';
  employer_contribution: string;
  employee_contribution: string;
}

function RegisterAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreatePension();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: {
      customer_name: '',
      account_type: '',
      pfa: '',
      rsa_number: '',
      currency: 'NGN',
      status: 'active',
      employer_contribution: '',
      employee_contribution: '',
    },
  });

  const accountType = watch('account_type');
  const pfa = watch('pfa');
  const currency = watch('currency');
  const status = watch('status');

  function onSubmit(data: RegisterForm) {
    const payload: CreatePensionPayload = {
      customer_name: data.customer_name.trim(),
      account_type: data.account_type as PensionAccountType,
      pfa: data.pfa,
      rsa_number: data.rsa_number.trim(),
      currency: data.currency,
      status: (data.status as PensionStatus) || 'active',
      employer_contribution: data.employer_contribution ? Number(data.employer_contribution) : 0,
      employee_contribution: data.employee_contribution ? Number(data.employee_contribution) : 0,
    };
    create(payload, {
      onSuccess: () => { reset(); onClose(); },
    });
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-amber-600" />
            Register Pension Account
          </DialogTitle>
          <DialogDescription>
            Register a new RSA or employer pension fund. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Customer / Fund Name *</Label>
            <Input
              placeholder="Full name or fund name"
              {...register('customer_name', { required: 'Name is required' })}
              className={errors.customer_name ? 'border-red-500' : ''}
            />
            {errors.customer_name && <p className="text-xs text-red-500">{errors.customer_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Account Type *</Label>
              <Select value={accountType} onValueChange={(v) => setValue('account_type', v as PensionAccountType, { shouldValidate: true })}>
                <SelectTrigger className={errors.account_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="employer">Employer</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" {...register('account_type', { required: 'Account type is required' })} />
              {errors.account_type && <p className="text-xs text-red-500">{errors.account_type.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>RSA Number *</Label>
              <Input
                placeholder="e.g. PEN-12345678"
                {...register('rsa_number', { required: 'RSA number is required' })}
                className={errors.rsa_number ? 'border-red-500' : ''}
              />
              {errors.rsa_number && <p className="text-xs text-red-500">{errors.rsa_number.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Pension Fund Administrator (PFA) *</Label>
            <Select value={pfa} onValueChange={(v) => setValue('pfa', v, { shouldValidate: true })}>
              <SelectTrigger className={errors.pfa ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select PFA…" />
              </SelectTrigger>
              <SelectContent>
                {PFAs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('pfa', { required: 'PFA is required' })} />
            {errors.pfa && <p className="text-xs text-red-500">{errors.pfa.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setValue('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Initial Status</Label>
              <Select value={status} onValueChange={(v) => setValue('status', v as PensionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Employer Contribution (₦)</Label>
              <Input type="number" min="0" placeholder="0" {...register('employer_contribution')} />
            </div>
            <div className="space-y-1.5">
              <Label>Employee Contribution (₦)</Label>
              <Input type="number" min="0" placeholder="0" {...register('employee_contribution')} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Register Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contribution History (inside detail sheet) ───────────────────────────────

function ContributionHistory({ accountId }: { accountId: string }) {
  const { data, isLoading } = usePensionContributions(accountId);
  const items = data?.items ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading contributions…</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No contributions recorded yet.</p>;

  return (
    <div className="space-y-2">
      {items.map((c) => (
        <div key={c.id} className="rounded-lg border p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{c.date}</span>
            <Badge variant="outline" className="capitalize text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{c.status}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Employer</span>
            <span className="text-blue-700 font-medium">{fmt(c.employer)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Employee</span>
            <span className="text-green-700 font-medium">{fmt(c.employee)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="font-semibold">Total</span>
            <span className="font-bold">{fmt(c.total)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function PensionDetailSheet({
  account,
  open,
  onClose,
}: {
  account: PensionAccount | null;
  open: boolean;
  onClose: () => void;
}) {
  const { mutate: pause,    isPending: pausing }    = usePausePension();
  const { mutate: resume,   isPending: resuming }   = useResumePension();
  const { mutate: withdraw, isPending: withdrawing } = useWithdrawPension();

  const [tab, setTab] = useState<'details' | 'contributions'>('details');

  if (!account) return null;

  const cfg = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.active;
  const employerPct = account.total_contributions > 0
    ? Math.round((account.employer_contribution / account.total_contributions) * 100)
    : 0;

  const busy = pausing || resuming || withdrawing;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-amber-600" />
            {account.customer_name}
          </SheetTitle>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>
            <Badge variant="outline" className="capitalize">{account.account_type}</Badge>
          </div>
        </SheetHeader>

        {/* Tab strip */}
        <div className="flex border-b mb-4">
          {(['details', 'contributions'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-amber-600 text-amber-700' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {([
                ['Account ID', account.id],
                ['RSA Number', account.rsa_number],
                ['PFA', account.pfa],
                ['Account Type', account.account_type],
                ['Currency', account.currency],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted-foreground text-xs">{k}</p>
                  <p className="font-medium capitalize">{v}</p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="font-semibold text-sm">Contribution Breakdown</p>
              {([
                ['Total Contributions', fmt(account.total_contributions), 'text-slate-900'],
                ['Employer Contribution', fmt(account.employer_contribution), 'text-blue-700'],
                ['Employee Contribution', fmt(account.employee_contribution), 'text-green-700'],
              ] as [string, string, string][]).map(([k, v, color]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{k}</span>
                  <span className={`font-bold ${color}`}>{v}</span>
                </div>
              ))}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Employer {employerPct}%</span>
                  <span>Employee {100 - employerPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${employerPct}%` }} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <p className="font-semibold text-sm">Actions</p>
              <div className="flex flex-wrap gap-2">
                {account.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => pause(account.id)}
                  >
                    {pausing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Pause Account
                  </Button>
                )}
                {account.status === 'inactive' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => resume(account.id)}
                  >
                    {resuming && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Resume Account
                  </Button>
                )}
                {account.status !== 'withdrawn' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Withdraw account for ${account.customer_name}? This cannot be undone.`)) {
                        withdraw(account.id, { onSuccess: onClose });
                      }
                    }}
                  >
                    {withdrawing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Withdraw
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'contributions' && (
          <ContributionHistory accountId={account.id} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Workspace ───────────────────────────────────────────────────────────

export default function PensionWorkspace() {
  const { data: listData, isLoading } = usePensionList();
  const { data: stats } = usePensionStats();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selected, setSelected] = useState<PensionAccount | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const items = listData?.items ?? [];

  const filtered = items.filter((a) => {
    const matchSearch = !search || [a.id, a.customer_name, a.pfa, a.rsa_number].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase()),
    );
    const matchType   = filterType   === 'all' || a.account_type === filterType;
    const matchStatus = filterStatus === 'all' || a.status        === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const totalContribs = items.reduce((s, a) => s + a.total_contributions, 0);
  const activeCount   = items.filter((a) => a.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-amber-600" />
            Pension Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            RSA accounts, PFA contributions, employer and individual pension funds
          </p>
        </div>
        <Button onClick={() => setRegisterOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Register Account
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Accounts',      value: stats?.total               ?? items.length,   icon: <Users       className="h-5 w-5 text-slate-600" />,   bg: 'bg-slate-50' },
          { label: 'Active Accounts',     value: stats?.active              ?? activeCount,     icon: <Landmark    className="h-5 w-5 text-emerald-600" />,  bg: 'bg-emerald-50' },
          { label: 'Employer Accounts',   value: stats?.employers           ?? items.filter((a) => a.account_type === 'employer').length,   icon: <TrendingUp  className="h-5 w-5 text-blue-600" />,    bg: 'bg-blue-50' },
          { label: 'Total Contributions', value: fmt(stats?.total_contributions ?? totalContribs), icon: <Banknote    className="h-5 w-5 text-amber-600" />,   bg: 'bg-amber-50' },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-lg ${c.bg}`}>{c.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold mt-0.5">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Pension Accounts</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, PFA, RSA…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-52"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="employer">Employer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterType !== 'all' || filterStatus !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearch(''); setFilterType('all'); setFilterStatus('all'); }}
                >
                  Clear
                </Button>
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
                  <TableHead>Customer / Fund</TableHead>
                  <TableHead>RSA Number</TableHead>
                  <TableHead>PFA</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Contributions</TableHead>
                  <TableHead className="text-right">Employer</TableHead>
                  <TableHead className="text-right">Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      No pension accounts found
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.active;
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelected(a)}
                    >
                      <TableCell className="font-mono text-xs font-medium">{a.id}</TableCell>
                      <TableCell className="font-medium text-sm">{a.customer_name}</TableCell>
                      <TableCell className="font-mono text-xs">{a.rsa_number}</TableCell>
                      <TableCell className="text-sm">{a.pfa}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{a.account_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">{fmt(a.total_contributions)}</TableCell>
                      <TableCell className="text-right text-blue-700">{fmt(a.employer_contribution)}</TableCell>
                      <TableCell className="text-right text-green-700">{fmt(a.employee_contribution)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PensionDetailSheet
        account={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />

      <RegisterAccountDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />
    </div>
  );
}
