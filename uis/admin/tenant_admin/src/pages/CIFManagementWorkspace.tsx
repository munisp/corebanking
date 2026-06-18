import { useState } from 'react';
import {
  Users, Search, ChevronRight, MapPin, Phone, FileCheck2,
  Link2, ShieldCheck, ShieldAlert, User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCIFList, useCIFStats } from '../hooks/useCIF';
import type { CIF } from '../types/cif';

function fmt(n: number) {
  return `₦${n.toLocaleString()}`;
}

const TIER_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-violet-100 text-violet-700',
};

function CIFDetailSheet({ cif, open, onClose }: { cif: CIF | null; open: boolean; onClose: () => void }) {
  if (!cif) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-600" />
            {cif.firstName} {cif.lastName}
          </SheetTitle>
          <div className="flex gap-2 mt-1">
            <Badge variant={cif.status === 'active' ? 'default' : 'secondary'}>{cif.status}</Badge>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIER_COLORS[cif.kycTier] ?? 'bg-gray-100 text-gray-700'}`}>
              KYC Tier {cif.kycTier}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">{cif.id}</span>
          </div>
        </SheetHeader>

        <Tabs defaultValue="profile">
          <TabsList className="mb-4">
            <TabsTrigger value="profile" className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Profile</TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Addresses</TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Contacts</TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-1.5"><FileCheck2 className="w-3.5 h-3.5" />KYC Docs</TabsTrigger>
            <TabsTrigger value="relationships" className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" />Relations</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                ['CIF ID', cif.id],
                ['BVN', cif.bvn],
                ['First Name', cif.firstName],
                ['Last Name', cif.lastName],
                ['Email', cif.email],
                ['Phone', cif.phone],
                ['Date of Birth', cif.dateOfBirth],
                ['Gender', cif.gender === 'M' ? 'Male' : cif.gender === 'F' ? 'Female' : cif.gender],
                ['KYC Tier', `Tier ${cif.kycTier}`],
                ['Status', cif.status],
                ['Accounts', String(cif.accountCount)],
                ['Total Balance', fmt(cif.totalBalance)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted-foreground">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="addresses">
            {cif.addresses.length === 0
              ? <p className="text-sm text-muted-foreground">No addresses on file</p>
              : (
                <div className="space-y-3">
                  {cif.addresses.map((a, i) => (
                    <div key={i} className="border rounded-lg p-4 text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="capitalize font-medium">{a.type}</span>
                        <div className="flex gap-2">
                          {a.isPrimary && <Badge variant="outline">Primary</Badge>}
                          {a.verified
                            ? <Badge variant="default" className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Verified</Badge>
                            : <Badge variant="outline" className="text-amber-600 border-amber-300 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Unverified</Badge>}
                        </div>
                      </div>
                      <p className="text-muted-foreground">{[a.line1, a.line2, a.city, a.state, a.country, a.postCode].filter(Boolean).join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
          </TabsContent>

          <TabsContent value="contacts">
            {cif.contacts.length === 0
              ? <p className="text-sm text-muted-foreground">No contacts on file</p>
              : (
                <div className="space-y-3">
                  {cif.contacts.map((c, i) => (
                    <div key={i} className="border rounded-lg p-4 text-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground capitalize">{c.type}</p>
                        <p className="font-medium">{c.value}</p>
                      </div>
                      <div className="flex gap-2">
                        {c.isPrimary && <Badge variant="outline">Primary</Badge>}
                        {c.verified
                          ? <Badge variant="default" className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Verified</Badge>
                          : <Badge variant="outline" className="text-amber-600 border-amber-300">Unverified</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </TabsContent>

          <TabsContent value="documents">
            {cif.kycDocuments.length === 0
              ? <p className="text-sm text-muted-foreground">No KYC documents on file</p>
              : (
                <div className="space-y-3">
                  {cif.kycDocuments.map((d, i) => (
                    <div key={i} className="border rounded-lg p-4 text-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{d.type}</p>
                        <p className="font-medium font-mono">{d.number}</p>
                        {d.expiryDate && <p className="text-xs text-muted-foreground mt-0.5">Expires {d.expiryDate}</p>}
                      </div>
                      {d.verified
                        ? <Badge variant="default" className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Verified</Badge>
                        : <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>}
                    </div>
                  ))}
                </div>
              )}
          </TabsContent>

          <TabsContent value="relationships">
            {cif.relationships.length === 0
              ? <p className="text-sm text-muted-foreground">No relationships on file</p>
              : (
                <div className="space-y-3">
                  {cif.relationships.map((r, i) => (
                    <div key={i} className="border rounded-lg p-4 text-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground capitalize">{r.type.replace('-', ' ')}</p>
                        <p className="font-medium">{r.relatedName}</p>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{r.relatedCifId}</span>
                    </div>
                  ))}
                </div>
              )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export default function CIFManagementWorkspace() {
  const { data: listData, isLoading } = useCIFList();
  const { data: stats } = useCIFStats();

  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selected, setSelected] = useState<CIF | null>(null);

  const items = listData?.items ?? [];

  const filtered = items.filter((c) => {
    const fullName = `${c.firstName} ${c.lastName}`;
    const matchSearch = !search || [c.id, c.bvn, c.email, c.phone, fullName].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    const matchTier = filterTier === 'all' || String(c.kycTier) === filterTier;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchTier && matchStatus;
  });

  const statCards = stats
    ? [
        { label: 'Total CIFs', value: stats.totalCIFs },
        { label: 'Total Accounts', value: stats.totalAccounts },
        { label: 'Total Balance', value: fmt(stats.totalBalance) },
        { label: 'KYC Documents', value: stats.totalKYCDocuments },
        { label: 'Avg KYC Tier', value: (stats.avgKYCTier ?? 0).toFixed(2) },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-cyan-600" />
          CIF Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customer Information File — profiles, KYC, addresses, contacts, and relationships
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((c) => (
            <Card key={c.label}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Customer Records</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, BVN, email, phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-60"
                />
              </div>
              <Select value={filterTier} onValueChange={setFilterTier}>
                <SelectTrigger className="w-32"><SelectValue placeholder="All tiers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tiers</SelectItem>
                  <SelectItem value="1">Tier 1</SelectItem>
                  <SelectItem value="2">Tier 2</SelectItem>
                  <SelectItem value="3">Tier 3</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterTier !== 'all' || filterStatus !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterTier('all'); setFilterStatus('all'); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CIF ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>BVN</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>KYC Tier</TableHead>
                  <TableHead className="text-right">Accounts</TableHead>
                  <TableHead className="text-right">Total Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading CIF records…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No CIF records found</TableCell></TableRow>}
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(c)}>
                    <TableCell className="font-mono text-xs font-medium">{c.id}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-muted-foreground">{c.gender === 'M' ? 'Male' : c.gender === 'F' ? 'Female' : c.gender}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.bvn}</TableCell>
                    <TableCell>
                      <p className="text-sm">{c.phone}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{c.email}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIER_COLORS[c.kycTier] ?? 'bg-gray-100 text-gray-700'}`}>
                        Tier {c.kycTier}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{c.accountCount}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.totalBalance)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="capitalize">{c.status}</Badge>
                    </TableCell>
                    <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CIFDetailSheet cif={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
