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

export default function SupplyChainFinanceWorkspace() {
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
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
        }}
      />
      <SCFCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
