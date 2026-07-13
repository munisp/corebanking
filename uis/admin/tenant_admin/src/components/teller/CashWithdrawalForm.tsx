import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Minus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { transactionService } from '@/services/tellerService';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CashWithdrawalFormProps {
  tellerId: string;
  tillId: string;
  tillBalance?: number;
  onSuccess?: () => void;
}

const NGN_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5];

export default function CashWithdrawalForm({ tellerId, tillId, tillBalance = 0, onSuccess }: CashWithdrawalFormProps) {
  const [loading, setLoading] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [denominationCounts, setDenominationCounts] = useState<Record<number, number>>({});

  // Calculate total amount
  const totalAmount = Object.entries(denominationCounts).reduce((sum, [denom, count]) => {
    return sum + (parseInt(denom) * count);
  }, 0);

  const handleDenominationChange = (denomination: number, count: number) => {
    setDenominationCounts(prev => ({
      ...prev,
      [denomination]: Math.max(0, count),
    }));
  };

  const incrementDenomination = (denomination: number) => {
    setDenominationCounts(prev => ({
      ...prev,
      [denomination]: (prev[denomination] || 0) + 1,
    }));
  };

  const decrementDenomination = (denomination: number) => {
    setDenominationCounts(prev => ({
      ...prev,
      [denomination]: Math.max(0, (prev[denomination] || 0) - 1),
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Check if withdrawal would exceed till balance
  const wouldExceedBalance = (totalAmount * 100) > tillBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountNumber) {
      toast.error('Please enter account number');
      return;
    }

    if (totalAmount === 0) {
      toast.error('Please enter cash denominations');
      return;
    }

    if (wouldExceedBalance) {
      toast.error('Insufficient till balance for this withdrawal');
      return;
    }

    setLoading(true);
    try {
      // Build denomination breakdown
        const denominations: any[] = Object.entries(denominationCounts)
        .filter(([_, count]) => count > 0)
        .map(([value, count]) => ({
          value: parseInt(value) * 100, // Convert to kobo
          currency: 'NGN',
          count,
          total: parseInt(value) * count * 100, // Convert to kobo
        }));

      const withdrawalData = {
        teller_id: tellerId,
        account_number: accountNumber,
          amount: totalAmount * 100,
          denomination_breakdown: {
            n1000: denominationCounts['1000'] || 0,
            n500: denominationCounts['500'] || 0,
            n200: denominationCounts['200'] || 0,
            n100: denominationCounts['100'] || 0,
            n50: denominationCounts['50'] || 0,
            n20: denominationCounts['20'] || 0,
            n10: denominationCounts['10'] || 0,
            n5: denominationCounts['5'] || 0,
          },
          transaction_notes: notes,
          customer_id: accountNumber,
      };

      await transactionService.cashWithdrawal(withdrawalData);
      
      toast.success('Cash withdrawal processed successfully');
      
      // Reset form
      setAccountNumber('');
      setCustomerName('');
      setNotes('');
      setDenominationCounts({});
      
      onSuccess?.();
    } catch (error: any) {
      console.error('Error processing cash withdrawal:', error);
      toast.error(error.response?.data?.message || 'Failed to process cash withdrawal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-red-600" />
          Cash Withdrawal
        </CardTitle>
        <CardDescription>Process cash withdrawal transaction</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Till Balance Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex justify-between items-center">
                <span>Current Till Balance:</span>
                <span className="font-bold">{formatCurrency(tillBalance / 100)}</span>
              </div>
            </AlertDescription>
          </Alert>

          {/* Customer Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="accountNumber">Account Number *</Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter account number"
                required
              />
            </div>

            <div>
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
          </div>

          {/* Denomination Entry */}
          <div className="space-y-4">
            <Label>Cash Denominations to Dispense</Label>
            <div className="border rounded-lg p-4 space-y-3">
              {NGN_DENOMINATIONS.map((denom) => {
                const count = denominationCounts[denom] || 0;
                const subtotal = denom * count;
                
                return (
                  <div key={denom} className="flex items-center gap-3">
                    <div className="w-24 font-medium">
                      ₦{denom.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() => decrementDenomination(denom)}
                        disabled={count === 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={count}
                        onChange={(e) => handleDenominationChange(denom, parseInt(e.target.value) || 0)}
                        className="w-20 text-center"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() => incrementDenomination(denom)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 text-right text-sm text-muted-foreground">
                      {subtotal > 0 ? formatCurrency(subtotal) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Amount */}
          <div className={`p-4 rounded-lg ${wouldExceedBalance ? 'bg-red-50 dark:bg-red-950' : 'bg-muted/50'}`}>
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Total Withdrawal Amount:</span>
              <span className={`text-2xl font-bold ${wouldExceedBalance ? 'text-red-600' : 'text-red-600'}`}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Total notes/coins: {Object.values(denominationCounts).reduce((sum, count) => sum + count, 0)}
            </div>
            {wouldExceedBalance && (
              <div className="text-sm text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Exceeds till balance by {formatCurrency((totalAmount * 100 - tillBalance) / 100)}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || !accountNumber || totalAmount === 0 || wouldExceedBalance}
              className="flex-1"
              variant={wouldExceedBalance ? "destructive" : "default"}
            >
              {loading ? 'Processing...' : `Process Withdrawal - ${formatCurrency(totalAmount)}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAccountNumber('');
                setCustomerName('');
                setNotes('');
                setDenominationCounts({});
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
