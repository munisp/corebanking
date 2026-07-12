import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { tillService, vaultService } from "@/services/tellerService";
import type { Till, Vault } from "@/types/teller";
import { ArrowRightLeft, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface TillTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const NGN_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5];

export default function TillTransferDialog({
  open,
  onOpenChange,
  onSuccess,
}: TillTransferDialogProps) {
  const [loading, setLoading] = useState(false);
  const [tills, setTills] = useState<Till[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);

  const [transferType, setTransferType] = useState<
    "till-to-vault" | "vault-to-till" | "till-to-till"
  >("till-to-vault");
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [reason, setReason] = useState("");
  const [denominationCounts, setDenominationCounts] = useState<
    Record<number, number>
  >({});

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [tillsData, vaultsData] = await Promise.all([
        tillService.listTills(),
        vaultService.listVaults(),
      ]);
      setTills(tillsData);
      setVaults(vaultsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load tills and vaults");
    }
  };

  const totalAmount = Object.entries(denominationCounts).reduce(
    (sum, [denom, count]) => {
      return sum + parseInt(denom) * count;
    },
    0,
  );

  const handleDenominationChange = (denomination: number, count: number) => {
    setDenominationCounts((prev) => ({
      ...prev,
      [denomination]: Math.max(0, count),
    }));
  };

  const incrementDenomination = (denomination: number) => {
    setDenominationCounts((prev) => ({
      ...prev,
      [denomination]: (prev[denomination] || 0) + 1,
    }));
  };

  const decrementDenomination = (denomination: number) => {
    setDenominationCounts((prev) => ({
      ...prev,
      [denomination]: Math.max(0, (prev[denomination] || 0) - 1),
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceId || !destId) {
      toast.error("Please select source and destination");
      return;
    }

    if (totalAmount === 0) {
      toast.error("Please enter cash denominations");
      return;
    }

    if (!reason) {
      toast.error("Please provide a reason for transfer");
      return;
    }

    setLoading(true);
    try {
      // Build denomination breakdown
      const denominations = Object.entries(denominationCounts)
        .filter(([, count]) => count > 0)
        .map(([value, count]) => ({
          value: parseInt(value) * 100, // Convert to kobo
          currency: "NGN",
          count,
          total: parseInt(value) * count * 100,
        }));

      const transferData = {
        source_type: (transferType.startsWith("till-to") ? "till" : "vault") as "till" | "vault",
        source_id: sourceId,
        dest_type: (transferType.endsWith("to-vault") ? "vault" : "till") as "till" | "vault",
        dest_id: destId,
        amount: totalAmount * 100, // Convert to kobo
        denomination_breakdown: {
          currency: "NGN",
          denominations,
          total_amount: totalAmount * 100,
          total_count: Object.values(denominationCounts).reduce(
            (sum, count) => sum + count,
            0,
          ),
          n1000: denominationCounts[1000] || 0,
          n500: denominationCounts[500] || 0,
          n200: denominationCounts[200] || 0,
          n100: denominationCounts[100] || 0,
          n50: denominationCounts[50] || 0,
          n20: denominationCounts[20] || 0,
          n10: denominationCounts[10] || 0,
          n5: denominationCounts[5] || 0,
        },
        reason,
      };

      await tillService.createTillTransfer(transferData);

      toast.success(
        "Transfer request created successfully. Awaiting approval.",
      );
      onSuccess();
      onOpenChange(false);

      // Reset form
      setSourceId("");
      setDestId("");
      setReason("");
      setDenominationCounts({});
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message || "Failed to create transfer request",
      );
    } finally {
      setLoading(false);
    }
  };

  const sourceOptions = transferType.startsWith("till-to")
    ? tills.filter((t) => t.status === "open")
    : vaults.filter((v) => v.status === "open");

  const destOptions = transferType.endsWith("to-vault") ? vaults : tills;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <ArrowRightLeft className="inline mr-2 h-5 w-5" />
            Create Till/Vault Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer cash between tills and vault. Requires supervisor approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Transfer Type */}
            <div className="grid gap-2">
              <Label>Transfer Type *</Label>
              <Select
                value={transferType}
                onValueChange={(
                  value: "till-to-vault" | "vault-to-till" | "till-to-till",
                ) => setTransferType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="till-to-vault">
                    Till → Vault (Deposit to Vault)
                  </SelectItem>
                  <SelectItem value="vault-to-till">
                    Vault → Till (Replenish Till)
                  </SelectItem>
                  <SelectItem value="till-to-till">
                    Till → Till (Transfer Between Tills)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source */}
            <div className="grid gap-2">
              <Label>
                Source {transferType.startsWith("till-to") ? "Till" : "Vault"} *
              </Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((item: Till | Vault) => {
                    const isTill = "till_id" in item;
                    const id = isTill ? item.till_id : item.vault_id;
                    const label = isTill
                      ? `Window ${item.window_number} - ${formatCurrency((item.balances?.NGN?.current_balance || 0) / 100)}`
                      : `${item.vault_name} - ${formatCurrency((item.balances?.NGN?.current_balance || 0) / 100)}`;
                    return (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Destination */}
            <div className="grid gap-2">
              <Label>
                Destination{" "}
                {transferType.endsWith("to-vault") ? "Vault" : "Till"} *
              </Label>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {destOptions.map((item: Till | Vault) => {
                    const isTill = "till_id" in item;
                    const id = isTill ? item.till_id : item.vault_id;
                    const label = isTill
                      ? `Window ${item.window_number}`
                      : item.vault_name;
                    return (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Denomination Breakdown */}
            <div className="grid gap-2">
              <Label>Cash Denomination Breakdown *</Label>
              <div className="border rounded-lg p-4 space-y-2">
                {NGN_DENOMINATIONS.map((denom) => (
                  <div
                    key={denom}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium w-24">
                      ₦{denom.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => decrementDenomination(denom)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={denominationCounts[denom] || 0}
                        onChange={(e) =>
                          handleDenominationChange(
                            denom,
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-20 text-center"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => incrementDenomination(denom)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="w-32 text-right font-medium">
                        {formatCurrency(
                          (denominationCounts[denom] || 0) * denom,
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between items-center font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for Transfer *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Daily vault deposit, Till replenishment"
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <strong>Note:</strong> This transfer request requires supervisor
              approval before execution.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Transfer Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
