import React, { useEffect, useState } from "react";
import CrudWorkspace from "@/components/CrudWorkspace";
import { Link, Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import apiClient from "@/services/api";
import kybService from "@/services/kybService";
import type { Business } from "@/types/kyb";
import { supplyChainOpsApi } from "@/api/tradeFinanceApi";

const PROGRAM_TYPES = ['invoice_discounting', 'reverse_factoring', 'payables_finance', 'distributor_finance'];

function BusinessCombobox({
  label,
  businesses,
  loading,
  selected,
  onSelect,
}: {
  label: string;
  businesses: Business[];
  loading: boolean;
  selected: Business | null;
  onSelect: (b: Business) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <Label>{label} <span className="text-destructive">*</span></Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" type="button" className="w-full justify-between" disabled={loading}>
            {selected ? selected.name : loading ? "Loading..." : `Select ${label.toLowerCase()}`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search business..." />
            <CommandList>
              <CommandEmpty>No business found.</CommandEmpty>
              <CommandGroup>
                {businesses.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={`${b.name} ${b.registration_number ?? ""}`}
                    onSelect={() => { onSelect(b); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected?.id === b.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="font-medium">{b.name}</span>
                      {b.registration_number && (
                        <span className="text-xs text-muted-foreground">Reg: {b.registration_number}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SCFCreateDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [buyer, setBuyer] = useState<Business | null>(null);
  const [supplier, setSupplier] = useState<Business | null>(null);
  const [amount, setAmount] = useState("");
  const [discountRate, setDiscountRate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [programName, setProgramName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBizLoading(true);
    kybService.getAllBusinesses()
      .then(setBusinesses)
      .catch(() => setBusinesses([]))
      .finally(() => setBizLoading(false));
  }, [open]);

  function reset() {
    setBuyer(null);
    setSupplier(null);
    setAmount("");
    setDiscountRate("");
    setDueDate("");
    setProgramName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyer) { toast.error("Please select a buyer"); return; }
    if (!supplier) { toast.error("Please select a supplier"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSubmitting(true);
    try {
      await apiClient.post("/supply-chain/api/v1/supply-chain/financing", {
        buyer: buyer.name,
        buyer_id: buyer.id,
        supplier: supplier.name,
        supplier_id: supplier.id,
        amount: Number(amount),
        discount_rate: discountRate ? Number(discountRate) : undefined,
        due_date: dueDate || undefined,
        program_name: programName || undefined,
      });
      toast.success("Supply chain finance record created");
      reset();
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to create record");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Supply Chain Finance</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <BusinessCombobox label="Buyer" businesses={businesses} loading={bizLoading} selected={buyer} onSelect={setBuyer} />
          <BusinessCombobox label="Supplier" businesses={businesses} loading={bizLoading} selected={supplier} onSelect={setSupplier} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Discount Rate (%)</Label>
              <Input type="number" min="0" step="0.01" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Program Type</Label>
              <Select value={programName} onValueChange={setProgramName}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {PROGRAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * W12 A4-P1-A — dialogs wiring previously-orphaned supply-chain-service routes:
 * invoice-financing/apply, po-financing/apply, financing/{id}/approve+disburse
 * (CrudWorkspace row actions below), system record-payment, relationships/create.
 */
type ScfDialogKind = "invoice" | "po" | "repayment" | "relationship" | null;

function ScfOpsDialog({ kind, onClose, onSuccess }: { kind: Exclude<ScfDialogKind, null>; onClose: () => void; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (kind === "invoice") {
        await supplyChainOpsApi.applyInvoiceFinancing({
          supplier_id: f.supplier_id,
          invoice_number: f.invoice_number,
          invoice_amount: Number(f.invoice_amount),
          financing_percentage: Number(f.financing_percentage),
          invoice_due_date: new Date(f.invoice_due_date).toISOString(),
          invoice_document_url: f.invoice_document_url,
        });
        toast.success("Invoice financing application submitted");
      } else if (kind === "po") {
        await supplyChainOpsApi.applyPoFinancing({
          supplier_id: f.supplier_id,
          buyer_id: f.buyer_id,
          po_number: f.po_number,
          po_amount: Number(f.po_amount),
          financing_amount: Number(f.financing_amount),
          delivery_date: new Date(f.delivery_date).toISOString(),
          po_document_url: f.po_document_url,
        });
        toast.success("PO financing application submitted");
      } else if (kind === "repayment") {
        await supplyChainOpsApi.recordPayment(f.financing_id, {
          transaction_id: f.transaction_id,
          amount: Number(f.amount),
          payment_date: f.payment_date,
          payment_method: f.payment_method,
        });
        toast.success("Repayment recorded");
      } else {
        await supplyChainOpsApi.createRelationship(f.supplier_id, f.buyer_id);
        toast.success("Supplier-buyer relationship created");
      }
      onSuccess();
      onClose();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<string, string> = {
    invoice: "Apply — Invoice Financing",
    po: "Apply — Purchase Order Financing",
    repayment: "Record Financing Repayment",
    relationship: "Link Supplier ↔ Buyer",
  };

  const field = (key: string, label: string, type = "text", required = true) => (
    <div className="space-y-1" key={key}>
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <Input type={type} required={required} value={f[key] ?? ""} onChange={set(key)} />
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{titles[kind]}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          {kind === "invoice" && (
            <>
              {field("supplier_id", "Supplier ID")}
              {field("invoice_number", "Invoice Number")}
              {field("invoice_amount", "Invoice Amount (₦)", "number")}
              {field("financing_percentage", "Financing %", "number")}
              {field("invoice_due_date", "Invoice Due Date", "date")}
              {field("invoice_document_url", "Invoice Document URL", "url")}
            </>
          )}
          {kind === "po" && (
            <>
              {field("supplier_id", "Supplier ID")}
              {field("buyer_id", "Buyer ID")}
              {field("po_number", "PO Number")}
              {field("po_amount", "PO Amount (₦)", "number")}
              {field("financing_amount", "Financing Amount (₦)", "number")}
              {field("delivery_date", "Delivery Date", "date")}
              {field("po_document_url", "PO Document URL", "url")}
            </>
          )}
          {kind === "repayment" && (
            <>
              {field("financing_id", "Financing ID (e.g. INV…)")}
              {field("transaction_id", "Payment Transaction ID")}
              {field("amount", "Amount (₦)", "number")}
              {field("payment_date", "Payment Date", "date")}
              {field("payment_method", "Payment Method (e.g. bank_transfer)")}
            </>
          )}
          {kind === "relationship" && (
            <>
              {field("supplier_id", "Supplier ID")}
              {field("buyer_id", "Buyer ID")}
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplyChainFinanceWorkspace() {
  const [createOpen, setCreateOpen] = useState(false);
  const [opsDialog, setOpsDialog] = useState<ScfDialogKind>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <div className="flex flex-wrap gap-2 px-6 pt-4">
        <Button size="sm" variant="outline" onClick={() => setOpsDialog("invoice")}>Apply: Invoice Financing</Button>
        <Button size="sm" variant="outline" onClick={() => setOpsDialog("po")}>Apply: PO Financing</Button>
        <Button size="sm" variant="outline" onClick={() => setOpsDialog("repayment")}>Record Repayment</Button>
        <Button size="sm" variant="outline" onClick={() => setOpsDialog("relationship")}>Link Supplier-Buyer</Button>
      </div>
      <CrudWorkspace
        key={refreshKey}
        onCreateClick={() => setCreateOpen(true)}
        config={{
          domainKey: "supply-chain-finance",
          title: "Supply Chain Finance",
          subtitle: "Invoice financing, reverse factoring, payables finance, supplier programs",
          icon: Link,
          accentColor: "text-orange-600",
          idField: "id",
          statusField: "status",
          searchFields: ["buyer", "supplier", "program_name"],
          apiBase: "/supply-chain/api/v1/supply-chain/financing",
          pageSize: 25,
          columns: [
            { key: "id", label: "Invoice ID" },
            { key: "buyer", label: "Buyer", sortable: true },
            { key: "supplier", label: "Supplier", sortable: true },
            { key: "amount", label: "Amount (NGN)", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
            { key: "discount_rate", label: "Discount %", sortable: true },
            { key: "due_date", label: "Due Date", sortable: true },
            { key: "program_name", label: "Program", sortable: true },
            { key: "status", label: "Status", sortable: true },
          ],
          fields: [],
          // W12 A4-P1-A: wire financing approve/disburse lifecycle actions.
          actions: [
            {
              label: "Approve",
              key: "approve",
              method: "POST",
              pathField: "financing_id",
              condition: (row) => ["pending", "submitted", "under_review"].includes(String(row.status ?? "").toLowerCase()),
            },
            {
              label: "Disburse",
              key: "disburse",
              method: "POST",
              pathField: "financing_id",
              condition: (row) => String(row.status ?? "").toLowerCase() === "approved",
            },
          ],
        }}
      />
      <SCFCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
      {opsDialog && (
        <ScfOpsDialog
          kind={opsDialog}
          onClose={() => setOpsDialog(null)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}
