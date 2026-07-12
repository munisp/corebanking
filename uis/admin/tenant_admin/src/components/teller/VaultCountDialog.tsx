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
import { vaultService } from "@/services/tellerService";
import type { Vault } from "@/types/teller";
import { AlertCircle, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface VaultCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: Vault | null;
  onSuccess: () => void;
}

const NGN_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5];

export default function VaultCountDialog({
  open,
  onOpenChange,
  vault,
  onSuccess,
}: VaultCountDialogProps) {
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [denominationCounts, setDenominationCounts] = useState<
    Record<number, number>
  >({});

  if (!vault) return null;

  const totalCounted = Object.entries(denominationCounts).reduce(
    (sum, [denom, count]) => {
      return sum + parseInt(denom) * count;
    },
    0,
  );

  const expectedBalance = (vault.balances?.NGN?.current_balance || 0) / 100;
  const discrepancy = totalCounted - expectedBalance;

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

  const handleStartCount = async () => {
    setLoading(true);
    try {
      await vaultService.startVaultCount(vault.vault_id);
      setCounting(true);
      toast.success("Vault counting session started");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to start vault count");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteCount = async () => {
    if (totalCounted === 0) {
      toast.error("Please enter cash denominations");
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

      const breakdown = {
        currency: "NGN",
        denominations,
        total_amount: totalCounted * 100,
        total_count: Object.values(denominationCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
      };

      const result = await vaultService.completeVaultCount(
        vault.vault_id,
        totalCounted * 100, // Convert to kobo
        "NGN",
        breakdown,
      );

      if (result.discrepancy === 0) {
        toast.success("Vault count completed. No discrepancy found.");
      } else {
        toast.warning(
          `Vault count completed. Discrepancy: ${formatCurrency(Math.abs(result.discrepancy / 100))}`,
        );
      }

      onSuccess();
      onOpenChange(false);

      // Reset state
      setCounting(false);
      setDenominationCounts({});
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message || "Failed to complete vault count",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vault Cash Count - {vault.vault_name}</DialogTitle>
          <DialogDescription>
            Count physical cash in the vault and reconcile with system balance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!counting ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Click "Start Counting" to begin the vault count session.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Expected Balance:</strong>{" "}
                  {formatCurrency(expectedBalance)}
                </p>
              </div>
              <Button onClick={handleStartCount} disabled={loading}>
                {loading ? "Starting..." : "Start Counting"}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 bg-muted p-3 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Expected Balance:</span>
                  <span className="text-sm">
                    {formatCurrency(expectedBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Counted Amount:</span>
                  <span className="text-sm font-bold">
                    {formatCurrency(totalCounted)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Discrepancy:</span>
                  <span
                    className={`text-sm font-bold ${
                      discrepancy === 0
                        ? "text-green-600"
                        : discrepancy > 0
                          ? "text-orange-600"
                          : "text-red-600"
                    }`}
                  >
                    {discrepancy === 0
                      ? "None"
                      : discrepancy > 0
                        ? `+${formatCurrency(discrepancy)}`
                        : formatCurrency(discrepancy)}
                  </span>
                </div>
              </div>

              {/* Denomination Breakdown */}
              <div className="grid gap-2">
                <Label>Cash Denomination Count</Label>
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
                    <span>Total Counted:</span>
                    <span>{formatCurrency(totalCounted)}</span>
                  </div>
                </div>
              </div>

              {discrepancy !== 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>Discrepancy Detected:</strong> The counted amount
                    differs from the system balance. This will be recorded and
                    may require investigation.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {counting && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCounting(false);
                setDenominationCounts({});
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteCount}
              disabled={loading || totalCounted === 0}
            >
              {loading ? "Completing..." : "Complete Count"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
