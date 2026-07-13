import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Calculator, TrendingDown, BarChart2, Shield, ChevronRight, Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  useLoanCalculationList, useCalculateLoan, useAmortizationSchedule,
  useAffordabilityCheck,
} from '../hooks/useLoanCalculator';
import type {
  LoanCalculation, CalculateLoanPayload, SchedulePayload,
  AffordabilityPayload, LoanType, RepaymentType, Installment,
} from '../types/loanCalculator';

function fmt(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const LOAN_TYPES: LoanType[] = ['mortgage', 'education', 'agriculture', 'personal', 'auto', 'murabaha', 'ijara'];
const REPAYMENT_TYPES: { value: RepaymentType; label: string }[] = [
  { value: 'equal_installment', label: 'Equal Installment (EMI)' },
  { value: 'reducing_balance', label: 'Reducing Balance' },
  { value: 'bullet', label: 'Bullet' },
  { value: 'balloon', label: 'Balloon' },
];

// ─── Amortization Sheet ───────────────────────────────────────────────────────

function ScheduleSheet({ calc, open, onClose }: { calc: LoanCalculation | null; open: boolean; onClose: () => void }) {
  const { mutate: getSchedule, data: schedule, isPending } = useAmortizationSchedule();

  function load() {
    if (!calc) return;
    getSchedule({
      principal: calc.principal,
      annualRate: calc.annualRate,
      tenorMonths: calc.tenorMonths,
      repaymentType: calc.repaymentType,
    });
  }

  if (!calc) return null;
  const installments: Installment[] = schedule?.installments ?? [];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" /> Amortization Schedule — {calc.id}
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            ['Principal', fmt(calc.principal)],
            ['Monthly EMI', fmt(calc.monthlyPayment)],
            ['Total Interest', fmt(calc.totalInterest)],
            ['Total Repayment', fmt(calc.totalRepayment)],
            ['Tenor', `${calc.tenorMonths} months`],
            ['Effective Rate', `${calc.effectiveRate}%`],
          ].map(([k, v]) => (
            <div key={k} className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="font-semibold text-sm mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        {installments.length === 0 ? (
          <Button onClick={load} disabled={isPending} className="mb-4">
            {isPending ? 'Loading…' : 'Load Schedule'}
          </Button>
        ) : (
          <div className="overflow-x-auto rounded border text-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Opening Bal</TableHead>
                  <TableHead className="text-right">EMI</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Closing Bal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((i) => (
                  <TableRow key={i.month}>
                    <TableCell>{i.month}</TableCell>
                    <TableCell className="text-right">{fmt(i.openingBalance)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(i.emi)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(i.principal)}</TableCell>
                    <TableCell className="text-right text-red-600">{fmt(i.interest)}</TableCell>
                    <TableCell className="text-right">{fmt(i.closingBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Calculator Tab ───────────────────────────────────────────────────────────

function CalculatorTab() {
  const { mutate: calculate, isPending, data: result } = useCalculateLoan();
  const { register, control, handleSubmit, formState: { errors } } = useForm<CalculateLoanPayload>({
    defaultValues: { loanType: 'personal', repaymentType: 'equal_installment' },
  });

  function onSubmit(data: CalculateLoanPayload) {
    calculate({
      ...data,
      principal: Number(data.principal),
      annualRate: Number(data.annualRate),
      tenorMonths: Number(data.tenorMonths),
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Loan Parameters</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input {...register('customerName')} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Loan Type <span className="text-destructive">*</span></Label>
                <Controller name="loanType" control={control} rules={{ required: true }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as LoanType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LOAN_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label>Repayment Type</Label>
                <Controller name="repaymentType" control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as RepaymentType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REPAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Principal (₦) <span className="text-destructive">*</span></Label>
                <Input type="number" {...register('principal', { required: true, min: 1 })} placeholder="5000000" />
                {errors.principal && <p className="text-xs text-destructive">Required</p>}
              </div>
              <div className="space-y-1">
                <Label>Annual Rate (%) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.1" {...register('annualRate', { required: true, min: 0 })} placeholder="18" />
              </div>
              <div className="space-y-1">
                <Label>Tenor (months) <span className="text-destructive">*</span></Label>
                <Input type="number" {...register('tenorMonths', { required: true, min: 1 })} placeholder="24" />
              </div>
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Calculating…' : 'Calculate'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader><CardTitle className="text-base text-blue-700">Calculation Result</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Monthly EMI', fmt(result.monthlyPayment)],
                ['Total Repayment', fmt(result.totalRepayment)],
                ['Total Interest', fmt(result.totalInterest)],
                ['Effective Rate', `${result.effectiveRate}%`],
              ].map(([k, v]) => (
                <div key={k} className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-bold text-lg mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ['Loan ID', result.id],
                ['Loan Type', result.loanType],
                ['Principal', fmt(result.principal)],
                ['Rate', `${result.annualRate}% p.a.`],
                ['Tenor', `${result.tenorMonths} months`],
                ['Repayment', result.repaymentType.replace('_', ' ')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium capitalize">{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Affordability Tab ────────────────────────────────────────────────────────

function AffordabilityTab() {
  const { mutate: check, isPending, data: result } = useAffordabilityCheck();
  const { register, handleSubmit, formState: { errors } } = useForm<AffordabilityPayload>({
    defaultValues: { dtiLimit: 40 },
  });

  function onSubmit(data: AffordabilityPayload) {
    check({
      monthlyIncome: Number(data.monthlyIncome),
      monthlyExpense: Number(data.monthlyExpense),
      existingEmi: Number(data.existingEmi),
      desiredTenor: Number(data.desiredTenor),
      annualRate: Number(data.annualRate),
      dtiLimit: Number(data.dtiLimit),
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Financials</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Monthly Income (₦) <span className="text-destructive">*</span></Label>
                <Input type="number" {...register('monthlyIncome', { required: true, min: 1 })} placeholder="500000" />
                {errors.monthlyIncome && <p className="text-xs text-destructive">Required</p>}
              </div>
              <div className="space-y-1">
                <Label>Monthly Expenses (₦)</Label>
                <Input type="number" {...register('monthlyExpense', { min: 0 })} placeholder="200000" />
              </div>
              <div className="space-y-1">
                <Label>Existing EMI (₦)</Label>
                <Input type="number" {...register('existingEmi', { min: 0 })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Desired Tenor (months)</Label>
                <Input type="number" {...register('desiredTenor', { min: 1 })} placeholder="24" />
              </div>
              <div className="space-y-1">
                <Label>Annual Rate (%)</Label>
                <Input type="number" step="0.1" {...register('annualRate', { min: 0 })} placeholder="18" />
              </div>
              <div className="space-y-1">
                <Label>DTI Limit (%)</Label>
                <Input type="number" {...register('dtiLimit', { min: 1, max: 100 })} placeholder="40" />
              </div>
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Checking…' : 'Check Affordability'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.eligible ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}>
          <CardHeader>
            <CardTitle className={`text-base flex items-center gap-2 ${result.eligible ? 'text-green-700' : 'text-red-700'}`}>
              <Shield className="w-4 h-4" />
              {result.eligible ? 'Customer is Eligible' : 'Insufficient Capacity'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Max EMI', fmt(result.maxEMI)],
                ['Max Principal', fmt(result.maxPrincipal)],
                ['Current DTI', `${result.currentDTI}%`],
                ['DTI Limit', `${result.dtiLimit}%`],
                ['Disposable Income', fmt(result.disposableIncome)],
              ].map(([k, v]) => (
                <div key={k} className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-bold mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, isLoading } = useLoanCalculationList();
  const [scheduleFor, setScheduleFor] = useState<LoanCalculation | null>(null);

  const items = data?.items ?? [];

  return (
    <>
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Tenor</TableHead>
              <TableHead className="text-right">Monthly EMI</TableHead>
              <TableHead className="text-right">Total Repayment</TableHead>
              <TableHead>Repayment Type</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && items.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No calculations yet — use the Calculator tab to run one</TableCell></TableRow>
            )}
            {items.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setScheduleFor(c)}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell className="text-sm">{c.customerName || '—'}</TableCell>
                <TableCell className="capitalize text-sm">{c.loanType}</TableCell>
                <TableCell className="text-right font-medium">{fmt(c.principal)}</TableCell>
                <TableCell className="text-sm">{c.annualRate}%</TableCell>
                <TableCell className="text-sm">{c.tenorMonths}m</TableCell>
                <TableCell className="text-right font-medium text-blue-700">{fmt(c.monthlyPayment)}</TableCell>
                <TableCell className="text-right font-medium">{fmt(c.totalRepayment)}</TableCell>
                <TableCell className="text-xs capitalize">{c.repaymentType.replace('_', ' ')}</TableCell>
                <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ScheduleSheet calc={scheduleFor} open={!!scheduleFor} onClose={() => setScheduleFor(null)} />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LoanCalculatorWorkspace() {
  const { data: listData } = useLoanCalculationList();
  const total = listData?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6 text-blue-600" />
          Loan Calculator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          EMI, amortization, affordability checks, and scenario comparison for all loan products
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Calculations', value: total },
          { label: 'Loan Types', value: LOAN_TYPES.length },
          { label: 'Repayment Methods', value: REPAYMENT_TYPES.length },
          { label: 'Islamic Products', value: '2 (Murabaha, Ijara)' },
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
        <CardContent className="pt-4">
          <Tabs defaultValue="calculator">
            <TabsList className="mb-6">
              <TabsTrigger value="calculator" className="flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5" />Calculator</TabsTrigger>
              <TabsTrigger value="affordability" className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Affordability</TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" />History ({total})</TabsTrigger>
            </TabsList>
            <TabsContent value="calculator"><CalculatorTab /></TabsContent>
            <TabsContent value="affordability"><AffordabilityTab /></TabsContent>
            <TabsContent value="history"><HistoryTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
