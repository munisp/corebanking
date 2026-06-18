import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { transactionService } from '@/services/tellerService';

interface CashDepositFormProps {
  tellerId: string;
  tillId: string;
  onSuccess?: () => void;
}

const NGN_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5];

export default function CashDepositForm({ tellerId, tillId, onSuccess }: CashDepositFormProps) {
  const [loading, setLoading] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountId, setAccountId] = useState('');
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

      const parsedAccountId = accountId ? parseInt(accountId, 10) : undefined;

      const depositData = {
        teller_id: tellerId,
        account_number: accountNumber,
        account_id: parsedAccountId,
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

      await transactionService.cashDeposit(depositData);
      
      toast.success('Cash deposit processed successfully');
      
      // Reset form
      setAccountNumber('');
      setAccountId('');
      setCustomerName('');
      setNotes('');
      setDenominationCounts({});
      
      onSuccess?.();
    } catch (error: any) {
      console.error('Error processing cash deposit:', error);
      toast.error(error.response?.data?.message || 'Failed to process cash deposit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Cash Deposit
        </CardTitle>
        <CardDescription>Process cash deposit transaction</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="accountId">Account ID *</Label>
              <Input
                id="accountId"
                type="number"
                min="1"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Enter account ID"
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
            <Label>Cash Denominations</Label>
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
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Total Deposit Amount:</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Total notes/coins: {Object.values(denominationCounts).reduce((sum, count) => sum + count, 0)}
            </div>
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
              disabled={loading || !accountNumber || !accountId || totalAmount === 0}
              className="flex-1"
            >
              {loading ? 'Processing...' : `Process Deposit - ${formatCurrency(totalAmount)}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAccountNumber('');
                setAccountId('');
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
