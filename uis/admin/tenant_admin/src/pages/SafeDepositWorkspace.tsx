import { useState } from 'react';
import { Box, ChevronRight, Plus, Search, UserPlus, Wrench, LogOut } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import {
  useSafeDepositList,
  useSafeDepositStats,
  useCreateBox,
  useAssignBox,
  useUpdateBox,
  useVacateBox,
} from '../hooks/useSafeDeposit';
import type { DepositBox, BoxStatus, BoxSize, CreateBoxInput, AssignBoxInput } from '../types/safeDeposit';

function fmt(n: number) {
  return `₦${n.toLocaleString()}`;
}

const STATUS_CONFIG: Record<BoxStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  occupied: { label: 'Occupied', variant: 'default' },
  available: { label: 'Available', variant: 'secondary' },
  maintenance: { label: 'Maintenance', variant: 'outline' },
};

const SIZE_COLORS: Record<string, string> = {
  small: 'bg-blue-100 text-blue-700',
  medium: 'bg-violet-100 text-violet-700',
  large: 'bg-amber-100 text-amber-700',
};

// ─── Create Box Dialog ───────────────────────────────────────────────────────

function CreateBoxDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate, isPending } = useCreateBox();
  const [form, setForm] = useState<CreateBoxInput>({
    box_size: 'small',
    branch: '',
    annual_rent: 0,
    currency: 'NGN',
  });

  function set(k: keyof CreateBoxInput, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit() {
    if (!form.branch || !form.box_size || !form.annual_rent) return;
    mutate(form, { onSuccess: onClose });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Safe Deposit Box
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Box Size</Label>
              <Select value={form.box_size} onValueChange={(v) => set('box_size', v as BoxSize)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency ?? 'NGN'} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Input placeholder="e.g. Lagos Island" value={form.branch} onChange={(e) => set('branch', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Annual Rent (₦)</Label>
            <Input type="number" min={0} placeholder="0" value={form.annual_rent || ''} onChange={(e) => set('annual_rent', Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Customer Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Pre-assign to customer" value={form.customer_name ?? ''} onChange={(e) => set('customer_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Customer ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="CUST-XXXX" value={form.customer_id ?? ''} onChange={(e) => set('customer_id', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Renewal Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input type="date" value={form.renewal_date ?? ''} onChange={(e) => set('renewal_date', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={isPending || !form.branch || !form.annual_rent}>
            {isPending ? 'Creating…' : 'Create Box'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Dialog ───────────────────────────────────────────────────────────

function AssignDialog({ box, open, onClose }: { box: DepositBox | null; open: boolean; onClose: () => void }) {
  const { mutate, isPending } = useAssignBox();
  const [form, setForm] = useState<Partial<AssignBoxInput>>({});

  function set(k: keyof AssignBoxInput, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit() {
    if (!box || !form.customer_id || !form.customer_name) return;
    mutate({ id: box.id, customer_id: form.customer_id, customer_name: form.customer_name, annual_rent: form.annual_rent, renewal_date: form.renewal_date }, {
      onSuccess: onClose,
    });
  }

  if (!box) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Assign Box {box.id}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Customer Name</Label>
            <Input placeholder="Full name" value={form.customer_name ?? ''} onChange={(e) => set('customer_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Customer ID</Label>
            <Input placeholder="CUST-XXXX" value={form.customer_id ?? ''} onChange={(e) => set('customer_id', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Annual Rent (₦) <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="number" min={0} placeholder={String(box.annual_rent)} value={form.annual_rent ?? ''} onChange={(e) => set('annual_rent', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Renewal Date</Label>
              <Input type="date" value={form.renewal_date ?? ''} onChange={(e) => set('renewal_date', e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={submit} disabled={isPending || !form.customer_id || !form.customer_name}>
            {isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Box Detail Sheet ────────────────────────────────────────────────────────

function BoxDetailSheet({
  box, open, onClose,
  onAssign, onSetMaintenance, onVacate,
}: {
  box: DepositBox | null;
  open: boolean;
  onClose: () => void;
  onAssign: () => void;
  onSetMaintenance: () => void;
  onVacate: () => void;
}) {
  if (!box) return null;
  const cfg = STATUS_CONFIG[box.status] ?? STATUS_CONFIG.available;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Box className="w-5 h-5 text-amber-600" /> {box.id}
          </SheetTitle>
          <div className="flex gap-2 mt-1">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${SIZE_COLORS[box.box_size] ?? 'bg-gray-100 text-gray-700'}`}>
              {box.box_size}
            </span>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm mb-6">
          {[
            ['Box ID', box.id],
            ['Size', box.box_size],
            ['Branch', box.branch],
            ['Customer', box.customer_name || '—'],
            ['Annual Rent', fmt(box.annual_rent)],
            ['Currency', box.currency],
            ['Renewal Date', box.renewal_date || '—'],
            ['Status', box.status],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-muted-foreground">{k}</p>
              <p className="font-medium capitalize">{v}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {box.status === 'available' && (
            <Button className="w-full" onClick={onAssign}>
              <UserPlus className="w-4 h-4 mr-2" /> Assign to Customer
            </Button>
          )}
          {box.status === 'occupied' && (
            <Button variant="outline" className="w-full" onClick={onVacate}>
              <LogOut className="w-4 h-4 mr-2" /> Vacate Box
            </Button>
          )}
          {box.status !== 'maintenance' && (
            <Button variant="outline" className="w-full" onClick={onSetMaintenance}>
              <Wrench className="w-4 h-4 mr-2" /> Set to Maintenance
            </Button>
          )}
          {box.status === 'maintenance' && (
            <Button variant="outline" className="w-full" onClick={onSetMaintenance}>
              <Wrench className="w-4 h-4 mr-2" /> Mark as Available
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Workspace ──────────────────────────────────────────────────────────

export default function SafeDepositWorkspace() {
  const { data: listData, isLoading } = useSafeDepositList();
  const { data: stats } = useSafeDepositStats();
  const updateBox = useUpdateBox();
  const vacateBox = useVacateBox();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [selected, setSelected] = useState<DepositBox | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const items = listData?.items ?? [];

  const filtered = items.filter((b) => {
    const matchSearch = !search || [b.id, b.customer_name, b.branch].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    const matchSize = filterSize === 'all' || b.box_size === filterSize;
    return matchSearch && matchStatus && matchSize;
  });

  const occupancyPct = stats && stats.total_boxes > 0
    ? Math.round((stats.occupied / stats.total_boxes) * 100)
    : 0;

  function handleSetMaintenance() {
    if (!selected) return;
    const next: BoxStatus = selected.status === 'maintenance' ? 'available' : 'maintenance';
    updateBox.mutate({ id: selected.id, status: next }, { onSuccess: () => setSelected(null) });
  }

  function handleVacate() {
    if (!selected) return;
    vacateBox.mutate({ id: selected.id }, { onSuccess: () => setSelected(null) });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Box className="w-6 h-6 text-amber-600" />
            Safe Deposit Boxes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Physical safe deposit box inventory and occupancy management</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Box
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Boxes</p>
              <p className="text-2xl font-bold mt-1">{stats.total_boxes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Occupied</p>
              <p className="text-2xl font-bold mt-1">{stats.occupied}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-2xl font-bold mt-1">{stats.available}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Maintenance</p>
              <p className="text-2xl font-bold mt-1">{stats.maintenance}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{stats.occupied} of {stats.total_boxes} boxes occupied</span>
              <span className="font-semibold">{occupancyPct}%</span>
            </div>
            <Progress value={occupancyPct} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Box Inventory</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search ID, customer, branch…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-52"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSize} onValueChange={setFilterSize}>
                <SelectTrigger className="w-32"><SelectValue placeholder="All sizes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sizes</SelectItem>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterStatus !== 'all' || filterSize !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterStatus('all'); setFilterSize('all'); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Box ID</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Annual Rent</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading boxes…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No boxes found</TableCell></TableRow>}
                {filtered.map((b) => {
                  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.available;
                  return (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(b)}>
                      <TableCell className="font-mono text-xs font-medium">{b.id}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${SIZE_COLORS[b.box_size] ?? 'bg-gray-100 text-gray-700'}`}>
                          {b.box_size}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{b.branch}</TableCell>
                      <TableCell className="text-sm">{b.customer_name || <span className="text-muted-foreground italic">—</span>}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(b.annual_rent)}</TableCell>
                      <TableCell className="text-sm">{b.renewal_date || '—'}</TableCell>
                      <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BoxDetailSheet
        box={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onAssign={() => setShowAssign(true)}
        onSetMaintenance={handleSetMaintenance}
        onVacate={handleVacate}
      />

      <CreateBoxDialog open={showCreate} onClose={() => setShowCreate(false)} />

      <AssignDialog
        box={selected}
        open={showAssign}
        onClose={() => { setShowAssign(false); setSelected(null); }}
      />
    </div>
  );
}
