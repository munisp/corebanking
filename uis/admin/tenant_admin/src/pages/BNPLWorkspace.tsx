import React, { useEffect, useState } from "react";
import CrudWorkspace from "@/components/CrudWorkspace";
import { CreditCard, Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import apiClient from "@/services/api";
import kybService from "@/services/kybService";
import type { Business } from "@/types/kyb";

function BNPLCreateDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("3");
  const [productDescription, setProductDescription] = useState("");
  const [creditScore, setCreditScore] = useState("");
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
    setSelectedBiz(null);
    setPurchaseAmount("");
    setInstallmentCount("3");
    setProductDescription("");
    setCreditScore("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBiz) { toast.error("Please select a business"); return; }
    if (!purchaseAmount || Number(purchaseAmount) <= 0) { toast.error("Enter a valid purchase amount"); return; }
    setSubmitting(true);
    try {
      await apiClient.post("/bnpl/v1/applications", {
        merchant_id: selectedBiz.id,
        purchase_amount: Number(purchaseAmount),
        installment_count: Number(installmentCount),
        product_description: productDescription.trim() || undefined,
        credit_score: creditScore ? Number(creditScore) : undefined,
      });
      toast.success("BNPL application created");
      reset();
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to create application");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New BNPL Application</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Business (Merchant) <span className="text-destructive">*</span></Label>
            <Popover open={bizOpen} onOpenChange={setBizOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" type="button" className="w-full justify-between" disabled={bizLoading}>
                  {selectedBiz ? selectedBiz.name : bizLoading ? "Loading..." : "Select business"}
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
                          onSelect={() => { setSelectedBiz(b); setBizOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedBiz?.id === b.id ? "opacity-100" : "opacity-0")} />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Purchase Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Instalments (1–12)</Label>
              <Input type="number" min="1" max="12" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Product Description</Label>
              <Input value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="e.g. Samsung Galaxy S24" />
            </div>
            <div className="space-y-1">
              <Label>Credit Score</Label>
              <Input type="number" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create Application"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BNPLWorkspace() {
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <CrudWorkspace
        key={refreshKey}
        onCreateClick={() => setCreateOpen(true)}
        config={{
          domainKey: "bnpl",
          title: "Buy Now Pay Later",
          subtitle: "BNPL applications — origination, approval, repayment schedules",
          icon: CreditCard,
          accentColor: "text-violet-700",
          idField: "application_id",
          statusField: "status",
          searchFields: ["application_id", "applicant_id", "merchant_id", "product_description"],
          apiBase: "/bnpl/v1/applications",
          pageSize: 25,
          columns: [
            { key: "application_id", label: "Application ID" },
            { key: "applicant_id",   label: "Applicant",    sortable: true },
            { key: "merchant_id",    label: "Merchant",     sortable: true },
            { key: "product_description", label: "Product" },
            { key: "purchase_amount",     label: "Amount",  sortable: true,
              render: (v) => `₦${Number(v).toLocaleString()}` },
            { key: "installment_count",   label: "Instalments", sortable: true },
            { key: "installment_amount",  label: "Per Instalment",
              render: (v) => `₦${Number(v).toLocaleString()}` },
            { key: "interest_rate",  label: "Rate %",       sortable: true,
              render: (v) => `${v}%` },
            { key: "bvn_verified",   label: "BVN",
              render: (v) => v ? "✓ Yes" : "No" },
            { key: "status",         label: "Status",       sortable: true },
            { key: "created_at",     label: "Applied",      sortable: true },
          ],
          actions: [
            { label: "Approve", key: "approve", variant: "success",     condition: (row) => row.status === "pending" },
            { label: "Decline", key: "decline", variant: "destructive", condition: (row) => row.status === "pending" },
          ],
          tabs: [
            {
              key: "schedule",
              label: "Repayment Schedule",
              apiBase: "/bnpl/v1/applications",
              subPath: "schedule",
              columns: [
                { key: "installment_no", label: "Instalment #" },
                { key: "due_date",       label: "Due Date" },
                { key: "amount",         label: "Amount", render: (v) => `₦${Number(v).toLocaleString()}` },
                { key: "status",         label: "Status" },
                { key: "paid_at",        label: "Paid At", render: (v) => v ? String(v) : "—" },
              ],
            },
          ],
          fields: [],
        }}
      />
      <BNPLCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
