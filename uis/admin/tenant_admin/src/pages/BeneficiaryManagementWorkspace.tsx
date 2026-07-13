import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Users, Star, StarOff, Trash2, ShieldCheck, ShieldAlert,
  Search, Plus, ChevronRight, SlidersHorizontal,
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useBeneficiaryList, useBankDirectory, useCreateBeneficiary,
  useDeleteBeneficiary, useNameEnquiry, useToggleFavorite, useSetLimits,
} from '../hooks/useBeneficiary';
import type { Beneficiary, CreateBeneficiaryPayload, AccountType } from '../types/beneficiary';

function fmt(n: number) {
  return `₦${n.toLocaleString()}`;
}

type AddFormValues = CreateBeneficiaryPayload & { __enquiry?: string };

function AddBeneficiaryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: bankDir } = useBankDirectory();
  const { mutateAsync: nameEnquiry, isPending: enquiryLoading } = useNameEnquiry();
  const { mutate: create, isPending } = useCreateBeneficiary();
  const [enquiryResult, setEnquiryResult] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<AddFormValues>({
    defaultValues: { accountType: 'savings', currency: 'NGN' },
  });

  const bankCode = watch('bankCode');
  const accountNumber = watch('accountNumber');

  async function runEnquiry() {
    if (!bankCode || !accountNumber || accountNumber.length !== 10) return;
    const res = await nameEnquiry({ bankCode, accountNumber });
    if (res.status === 'verified') {
      setEnquiryResult(res.accountName);
      setValue('name', res.accountName);
    }
  }

  function onSubmit(data: AddFormValues) {
    const { __enquiry: _, ...payload } = data;
    create(payload as CreateBeneficiaryPayload, { onSuccess: () => { onClose(); setEnquiryResult(null); } });
  }

  const banks = bankDir?.banks ?? [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Beneficiary
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Customer ID <span className="text-destructive">*</span></Label>
              <Input {...register('customerId', { required: 'Required' })} placeholder="CIF-100" />
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Bank <span className="text-destructive">*</span></Label>
              <Controller
                name="bankCode"
                control={control}
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.bankCode && <p className="text-xs text-destructive">{errors.bankCode.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Account Number <span className="text-destructive">*</span></Label>
              <div className="flex gap-1">
                <Input
                  {...register('accountNumber', {
                    required: 'Required',
                    pattern: { value: /^\d{10}$/, message: 'Must be 10 digits' },
                  })}
                  placeholder="0123456789"
                  maxLength={10}
                />
                <Button type="button" variant="outline" size="sm" onClick={runEnquiry} disabled={enquiryLoading || !bankCode || accountNumber?.length !== 10}>
                  {enquiryLoading ? '…' : 'Verify'}
                </Button>
              </div>
              {errors.accountNumber && <p className="text-xs text-destructive">{errors.accountNumber.message}</p>}
              {enquiryResult && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> {enquiryResult}
                </p>
              )}
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Beneficiary Name <span className="text-destructive">*</span></Label>
              <Input {...register('name', { required: 'Required' })} placeholder="Full name" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Nickname</Label>
              <Input {...register('nickname')} placeholder="e.g. Mum, Office" />
            </div>

            <div className="space-y-1">
              <Label>Account Type</Label>
              <Controller
                name="accountType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as AccountType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="domiciliary">Domiciliary</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Adding…' : 'Add Beneficiary'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SetLimitsDialog({
  beneficiary,
  open,
  onClose,
}: { beneficiary: Beneficiary | null; open: boolean; onClose: () => void }) {
  const { mutate: setLimits, isPending } = useSetLimits();
  const { register, handleSubmit, formState: { errors } } = useForm<{ dailyLimit: number; monthlyLimit: number }>({
    values: beneficiary
      ? { dailyLimit: beneficiary.dailyLimit, monthlyLimit: beneficiary.monthlyLimit }
      : { dailyLimit: 0, monthlyLimit: 0 },
  });

  if (!beneficiary) return null;

  function onSubmit(data: { dailyLimit: number; monthlyLimit: number }) {
    setLimits(
      { beneficiaryId: beneficiary!.id, dailyLimit: Number(data.dailyLimit), monthlyLimit: Number(data.monthlyLimit) },
      { onSuccess: onClose }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Set Transfer Limits
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{beneficiary.name} — {beneficiary.bankName}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Daily Limit (₦) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              {...register('dailyLimit', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })}
            />
            {errors.dailyLimit && <p className="text-xs text-destructive">{errors.dailyLimit.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Monthly Limit (₦) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              {...register('monthlyLimit', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })}
            />
            {errors.monthlyLimit && <p className="text-xs text-destructive">{errors.monthlyLimit.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : 'Update Limits'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BeneficiaryManagementWorkspace() {
  const { data, isLoading } = useBeneficiaryList();
  const { mutate: deleteBen, isPending: deleting } = useDeleteBeneficiary();
  const { mutate: toggleFav } = useToggleFavorite();

  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState<string>('all');
  const [filterFav, setFilterFav] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [limitsFor, setLimitsFor] = useState<Beneficiary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Beneficiary | null>(null);
  const [detail, setDetail] = useState<Beneficiary | null>(null);

  const items = data?.items ?? [];

  const filtered = items.filter((b) => {
    const matchSearch = !search || [b.name, b.accountNumber, b.bankName, b.customerId, b.id].some(
      (f) => f?.toLowerCase().includes(search.toLowerCase())
    );
    const matchVerified = filterVerified === 'all' || (filterVerified === 'verified' ? b.verified : !b.verified);
    const matchFav = filterFav === 'all' || (filterFav === 'favorites' ? b.isFavorite : !b.isFavorite);
    return matchSearch && matchVerified && matchFav;
  });

  const total = items.length;
  const verified = items.filter((b) => b.verified).length;
  const favorites = items.filter((b) => b.isFavorite).length;
  const totalSent = items.reduce((s, b) => s + (b.totalSent ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-600" />
            Beneficiary Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Saved payees, name verification, transfer limits</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Beneficiary
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Beneficiaries', value: total },
          { label: 'Verified', value: verified },
          { label: 'Favorites', value: favorites },
          { label: 'Total Sent', value: fmt(totalSent) },
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
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Beneficiaries</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, account, bank…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-56"
                />
              </div>
              <Select value={filterVerified} onValueChange={setFilterVerified}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterFav} onValueChange={setFilterFav}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="favorites">Favorites</SelectItem>
                  <SelectItem value="non-favorites">Non-favorites</SelectItem>
                </SelectContent>
              </Select>
              {(search || filterVerified !== 'all' || filterFav !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterVerified('all'); setFilterFav('all'); }}>Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Bank / Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Daily Limit</TableHead>
                  <TableHead className="text-right">Monthly Limit</TableHead>
                  <TableHead className="text-right">Txn Count</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Fav</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading beneficiaries…</TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No beneficiaries found</TableCell>
                  </TableRow>
                )}
                {filtered.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetail(b)}>
                    <TableCell>
                      <p className="font-medium text-sm">{b.name}</p>
                      {b.nickname && <p className="text-xs text-muted-foreground">"{b.nickname}"</p>}
                      <p className="text-xs text-muted-foreground font-mono">{b.id}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{b.bankName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{b.accountNumber}</p>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{b.accountType}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(b.dailyLimit)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(b.monthlyLimit)}</TableCell>
                    <TableCell className="text-right text-sm">{b.txnCount}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {b.verified
                        ? <Badge variant="default" className="flex items-center gap-1 w-fit"><ShieldCheck className="w-3 h-3" />Verified</Badge>
                        : <Badge variant="outline" className="flex items-center gap-1 w-fit text-amber-600 border-amber-300"><ShieldAlert className="w-3 h-3" />Pending</Badge>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFav(b.id)}
                      >
                        {b.isFavorite
                          ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                          : <StarOff className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLimitsFor(b)}
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(b)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!detail} onOpenChange={() => setDetail(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-600" /> {detail.name}
                </SheetTitle>
                <div className="flex gap-2 mt-1">
                  {detail.verified
                    ? <Badge variant="default" className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Verified</Badge>
                    : <Badge variant="outline" className="text-amber-600 border-amber-300">Pending verification</Badge>}
                  {detail.isFavorite && <Badge variant="secondary" className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-500" />Favorite</Badge>}
                </div>
              </SheetHeader>
              <div className="space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    ['Beneficiary ID', detail.id],
                    ['Customer ID', detail.customerId],
                    ['Bank', detail.bankName],
                    ['Bank Code', detail.bankCode],
                    ['Account No.', detail.accountNumber],
                    ['Account Type', detail.accountType],
                    ['Currency', detail.currency],
                    ['Daily Limit', fmt(detail.dailyLimit)],
                    ['Monthly Limit', fmt(detail.monthlyLimit)],
                    ['Total Sent', fmt(detail.totalSent)],
                    ['Transactions', String(detail.txnCount)],
                    ['Last Used', detail.lastUsedAt ? new Date(detail.lastUsedAt).toLocaleDateString() : '—'],
                    ['Created', new Date(detail.createdAt).toLocaleDateString()],
                    ...(detail.verifiedName ? [['Verified Name', detail.verifiedName]] : []),
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-muted-foreground">{k}</p>
                      <p className="font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => { setDetail(null); setLimitsFor(detail); }}>
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Set Limits
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-2" onClick={() => { setDetail(null); setDeleteTarget(detail); }}>
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddBeneficiaryDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <SetLimitsDialog beneficiary={limitsFor} open={!!limitsFor} onClose={() => setLimitsFor(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove beneficiary?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.bankName} {deleteTarget?.accountNumber}) from the beneficiary list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteBen(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                }
              }}
              disabled={deleting}
            >
              {deleting ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
