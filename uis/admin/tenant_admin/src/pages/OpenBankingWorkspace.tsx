import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Globe, Plus, Search, ChevronRight, Shield, BookOpen, BarChart2 } from 'lucide-react';
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
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  useOBConsents, useCreateOBConsent, useOBTPPs, useOBAPICatalog, useOpenBankingStats,
} from '../hooks/useOpenBanking';
import type {
  OBConsent, TPP, OBAPIEndpoint, CreateConsentPayload, ConsentType, ConsentStatus,
} from '../types/openBanking';

const CONSENT_STATUS_CFG: Record<ConsentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  authorized: { label: 'Authorized', variant: 'default' },
  awaiting_authorization: { label: 'Awaiting Auth', variant: 'secondary' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  revoked: { label: 'Revoked', variant: 'outline' },
  expired: { label: 'Expired', variant: 'outline' },
};

const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  ais: 'AIS',
  pis: 'PIS',
  cbpii: 'CBPII',
};

const PERMISSIONS_BY_TYPE: Record<ConsentType, string[]> = {
  ais: ['ReadAccountsBasic', 'ReadAccountsDetail', 'ReadBalances', 'ReadTransactionsBasic', 'ReadTransactionsDetail'],
  pis: ['CreatePayment', 'ReadPaymentDetails'],
  cbpii: ['ReadFundsAvailability'],
};

function CreateConsentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateOBConsent();
  const { data: tppsData } = useOBTPPs();
  const activeTpps = (tppsData?.items ?? []).filter((t) => t.status === 'active');

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateConsentPayload>({
    defaultValues: { consentType: 'ais', permissions: [], accounts: [] },
  });

  const consentType = watch('consentType');
  const availablePermissions = PERMISSIONS_BY_TYPE[consentType] ?? [];

  function onSubmit(data: CreateConsentPayload) {
    create(data, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Consent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Customer ID <span className="text-destructive">*</span></Label>
              <Input {...register('customerId', { required: true })} placeholder="CUST-001" />
              {errors.customerId && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1">
              <Label>TPP <span className="text-destructive">*</span></Label>
              <Controller name="tppId" control={control} rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select TPP" /></SelectTrigger>
                    <SelectContent>
                      {activeTpps.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.tppName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tppId && <p className="text-xs text-destructive">Required</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Consent Type <span className="text-destructive">*</span></Label>
            <Controller name="consentType" control={control} rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { field.onChange(v as ConsentType); setValue('permissions', []); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ais">AIS — Account Information</SelectItem>
                    <SelectItem value="pis">PIS — Payment Initiation</SelectItem>
                    <SelectItem value="cbpii">CBPII — Confirmation of Funds</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Permissions <span className="text-destructive">*</span></Label>
            <Controller name="permissions" control={control} rules={{ validate: (v) => v.length > 0 || 'Select at least one' }}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {availablePermissions.map((p) => {
                    const checked = field.value.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          field.onChange(checked ? field.value.filter((x) => x !== p) : [...field.value, p]);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${checked ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.permissions && <p className="text-xs text-destructive">{errors.permissions.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Account Numbers</Label>
            <Input {...register('accounts')} placeholder="Comma-separated account numbers" />
            <p className="text-xs text-muted-foreground">Separate multiple accounts with commas</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Consent'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConsentDetailSheet({ consent, open, onClose }: { consent: OBConsent | null; open: boolean; onClose: () => void }) {
  if (!consent) return null;
  const cfg = CONSENT_STATUS_CFG[consent.status] ?? CONSENT_STATUS_CFG.expired;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[460px] sm:max-w-[460px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Consent {consent.id}
          </SheetTitle>
          <div className="flex gap-2">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <Badge variant="outline">{CONSENT_TYPE_LABELS[consent.consentType]}</Badge>
          </div>
        </SheetHeader>
        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              ['Customer ID', consent.customerId],
              ['Customer', consent.customerName],
              ['TPP', consent.tppName],
              ['TPP ID', consent.tppId],
              ['Access Count', String(consent.accessCount)],
              ['Created', new Date(consent.createdAt).toLocaleDateString()],
              ['Expires', new Date(consent.expiresAt).toLocaleDateString()],
              ['Last Access', consent.lastAccessedAt ? new Date(consent.lastAccessedAt).toLocaleDateString() : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-muted-foreground">{k}</p>
                <p className="font-medium">{v}</p>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {consent.permissions.map((p) => (
                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
              ))}
            </div>
          </div>
          {consent.accounts.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Accounts</p>
              <div className="flex flex-wrap gap-1.5">
                {consent.accounts.map((a) => (
                  <Badge key={a} variant="outline" className="font-mono text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConsentsTab() {
  const { data: consentsData, isLoading } = useOBConsents();
  const consents = consentsData?.items ?? [];
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<OBConsent | null>(null);

  const filtered = consents.filter((c) => {
    const matchSearch = !search || [c.id, c.customerId, c.customerName, c.tppName].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    return matchSearch && (filterType === 'all' || c.consentType === filterType) && (filterStatus === 'all' || c.status === filterStatus);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search customer, TPP…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-52" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="ais">AIS</SelectItem>
              <SelectItem value="pis">PIS</SelectItem>
              <SelectItem value="cbpii">CBPII</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="authorized">Authorized</SelectItem>
              <SelectItem value="awaiting_authorization">Awaiting Auth</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          {(search || filterType !== 'all' || filterStatus !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterType('all'); setFilterStatus('all'); }}>Clear</Button>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Consent
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>TPP</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Access Count</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No consents found</TableCell></TableRow>}
            {filtered.map((c) => {
              const cfg = CONSENT_STATUS_CFG[c.status] ?? CONSENT_STATUS_CFG.expired;
              return (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(c)}>
                  <TableCell className="font-mono text-xs font-medium">{c.id}</TableCell>
                  <TableCell className="text-sm">{c.customerName}</TableCell>
                  <TableCell className="text-sm">{c.tppName}</TableCell>
                  <TableCell><Badge variant="outline">{CONSENT_TYPE_LABELS[c.consentType]}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.permissions.length} permissions</TableCell>
                  <TableCell className="text-sm">{c.accessCount.toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{new Date(c.expiresAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                  <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CreateConsentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ConsentDetailSheet consent={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function tppStatusVariant(s: TPP['status']): 'default' | 'secondary' | 'outline' {
  if (s === 'active') return 'default';
  if (s === 'suspended') return 'secondary';
  return 'outline';
}

function TPPsTab() {
  const { data: tppsResult, isLoading } = useOBTPPs();
  const tpps = tppsResult?.items ?? [];
  const [search, setSearch] = useState('');

  const filtered = tpps.filter((t) => !search || [t.id, t.tppName, t.registrationNo, t.contactEmail].some(
    (f) => f?.toLowerCase().includes(search.toLowerCase())
  ));

  return (
    <div className="space-y-4">
      <div className="relative w-56">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search TPP, reg no…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Registration No</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Cert Issuer</TableHead>
              <TableHead>Cert Expiry</TableHead>
              <TableHead>Consents</TableHead>
              <TableHead>API Versions</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No TPPs found</TableCell></TableRow>}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs font-medium">{t.id}</TableCell>
                <TableCell className="font-medium text-sm">{t.tppName}</TableCell>
                <TableCell className="font-mono text-xs">{t.registrationNo}</TableCell>
                <TableCell><Badge variant="outline" className="uppercase">{t.role}</Badge></TableCell>
                <TableCell className="text-sm">{t.certIssuer}</TableCell>
                <TableCell className="text-sm">{new Date(t.certExpiry).toLocaleDateString()}</TableCell>
                <TableCell className="text-sm">{t.consentCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.apiVersions.join(', ')}</TableCell>
                <TableCell><Badge variant={tppStatusVariant(t.status)} className="capitalize">{t.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function APICatalogTab() {
  const { data: endpointsData, isLoading } = useOBAPICatalog();
  const endpoints = endpointsData?.items ?? [];
  const [search, setSearch] = useState('');

  const filtered = endpoints.filter((e) => !search || [e.path, e.description, e.category].some(
    (f) => f?.toLowerCase().includes(search.toLowerCase())
  ));

  const grouped = filtered.reduce<Record<string, OBAPIEndpoint[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});

  const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-green-100 text-green-700',
    PUT: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
    PATCH: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search endpoint, category…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>
      {isLoading && <p className="text-center py-12 text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && <p className="text-center py-12 text-muted-foreground">No endpoints found</p>}
      {Object.entries(grouped).map(([category, eps]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead className="text-right">Rate Limit</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eps.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${METHOD_COLORS[e.method] ?? 'bg-gray-100 text-gray-700'}`}>
                        {e.method}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.path}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.version}</TableCell>
                    <TableCell className="text-xs">{e.authType}</TableCell>
                    <TableCell className="text-right text-xs">{e.rateLimit}/min</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatsTab() {
  const { data: stats } = useOpenBankingStats();

  if (!stats) {
    return <p className="text-center py-12 text-muted-foreground">Loading stats…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Consents', value: stats.totalConsents.toLocaleString() },
          { label: 'Active Consents', value: stats.activeConsents.toLocaleString() },
          { label: 'Total TPPs', value: stats.totalTPPs.toLocaleString() },
          { label: 'Active TPPs', value: stats.activeTPPs.toLocaleString() },
          { label: 'API Accesses', value: stats.totalAPIAccesses.toLocaleString() },
          { label: 'API Endpoints', value: stats.apiEndpoints.toLocaleString() },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.byConsentType && Object.keys(stats.byConsentType).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Consents by Type</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.byConsentType).map(([type, count]) => {
                const pct = stats.totalConsents > 0 ? Math.round((count / stats.totalConsents) * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium uppercase">{type}</span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function OpenBankingWorkspace() {
  const { data: stats } = useOpenBankingStats();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-600" />
          Open Banking
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consent management, TPP registry, and API catalog
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Consents', value: stats.activeConsents },
            { label: 'Active TPPs', value: stats.activeTPPs },
            { label: 'API Accesses', value: stats.totalAPIAccesses.toLocaleString() },
            { label: 'Endpoints', value: stats.apiEndpoints },
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

      <Tabs defaultValue="consents">
        <TabsList>
          <TabsTrigger value="consents" className="gap-2">
            <Shield className="w-4 h-4" /> Consents
          </TabsTrigger>
          <TabsTrigger value="tpps" className="gap-2">
            <Globe className="w-4 h-4" /> TPPs
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2">
            <BookOpen className="w-4 h-4" /> API Catalog
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart2 className="w-4 h-4" /> Stats
          </TabsTrigger>
        </TabsList>
        <TabsContent value="consents" className="mt-4"><ConsentsTab /></TabsContent>
        <TabsContent value="tpps" className="mt-4"><TPPsTab /></TabsContent>
        <TabsContent value="catalog" className="mt-4"><APICatalogTab /></TabsContent>
        <TabsContent value="stats" className="mt-4"><StatsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
