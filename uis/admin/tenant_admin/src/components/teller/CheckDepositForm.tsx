import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { transactionService } from '@/services/tellerService';


interface CheckDepositFormProps {
  tellerId: string;
  onSuccess?: () => void;
}

export default function CheckDepositForm({ tellerId, onSuccess }: CheckDepositFormProps) {
  const [loading, setLoading] = useState(false);
  
  // Account information
  const [accountNumber, setAccountNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  
  // Check details
  const [checkNumber, setCheckNumber] = useState('');
  const [checkDate, setCheckDate] = useState('');
  const [amount, setAmount] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerBank, setPayerBank] = useState('');
  const [payerBankCode, setPayerBankCode] = useState('');
  const [payerAccount, setPayerAccount] = useState('');
  
  // Hold information
    const [holdType, setHoldType] = useState<string>('standard');
  const [signatureVerified, setSignatureVerified] = useState(false);
  
  // Images
  const [frontImageFile, setFrontImageFile] = useState<File | null>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  
  const [notes, setNotes] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleFrontImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFrontImageFile(e.target.files[0]);
    }
  };

  const handleBackImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBackImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountNumber || !checkNumber || !amount || !payerName) {
      toast.error('Please fill in all required fields');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const holdDays: Record<string, number> = {
        none: 0,
        standard: 2,
        extended: 7,
        exception: 10,
        large_check: 7,
      };

      const holdReleaseDate = new Date();
      holdReleaseDate.setDate(holdReleaseDate.getDate() + (holdDays[holdType] || 0));

      const checkDepositData = {
        teller_id: tellerId,
        customer_id: customerName || accountNumber,
        account_number: accountNumber,
        amount: amountValue,
        check_details: {
          check_number: checkNumber,
          check_date: checkDate || new Date().toISOString().split('T')[0],
          drawer_account: payerAccount,
          drawer_name: payerName,
          bank_name: payerBank,
          bank_code: payerBankCode,
          hold_period_days: holdDays[holdType] || 0,
          available_date: holdReleaseDate.toISOString().split('T')[0],
          clearing_status: 'pending' as const,
          check_image_url: frontImageFile ? `check-front-${checkNumber}` : undefined,
        },
        transaction_notes: notes,
      };

      await transactionService.checkDeposit(checkDepositData);

      toast.success('Check deposit processed successfully');

      // Reset form
      setAccountNumber('');
      setCustomerName('');
      setCheckNumber('');
      setCheckDate('');
      setAmount('');
      setPayerName('');
      setPayerBank('');
      setPayerBankCode('');
      setPayerAccount('');
      setHoldType('standard');
      setSignatureVerified(false);
      setFrontImageFile(null);
      setBackImageFile(null);
      setNotes('');

      onSuccess?.();
    } catch (error: any) {
      console.error('Error processing check deposit:', error);
      toast.error(error.response?.data?.message || 'Failed to process check deposit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Check Deposit
        </CardTitle>
        <CardDescription>Process check deposit transaction</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Customer Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          {/* Check Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Check Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="checkNumber">Check Number *</Label>
                <Input
                  id="checkNumber"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="Enter check number"
                  required
                />
              </div>
              <div>
                <Label htmlFor="checkDate">Check Date</Label>
                <Input
                  id="checkDate"
                  type="date"
                  value={checkDate}
                  onChange={(e) => setCheckDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount (₦) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="payerName">Payer Name *</Label>
                <Input
                  id="payerName"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Name on check"
                  required
                />
              </div>
              <div>
                <Label htmlFor="payerBank">Payer Bank</Label>
                <Input
                  id="payerBank"
                  value={payerBank}
                  onChange={(e) => setPayerBank(e.target.value)}
                  placeholder="Bank name"
                />
              </div>
              <div>
                <Label htmlFor="payerBankCode">Bank Code</Label>
                <Input
                  id="payerBankCode"
                  value={payerBankCode}
                  onChange={(e) => setPayerBankCode(e.target.value)}
                  placeholder="Sort code"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="payerAccount">Payer Account Number</Label>
                <Input
                  id="payerAccount"
                  value={payerAccount}
                  onChange={(e) => setPayerAccount(e.target.value)}
                  placeholder="Account number on check"
                />
              </div>
            </div>
          </div>

          {/* Hold Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Hold Type</h3>
            <Select value={holdType} onValueChange={(value) => setHoldType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Immediate)</SelectItem>
                <SelectItem value="standard">Standard (2 days)</SelectItem>
                <SelectItem value="extended">Extended (7 days)</SelectItem>
                <SelectItem value="exception">Exception (10 days)</SelectItem>
                <SelectItem value="large_check">Large Check (7 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Verification */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Verification</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="signatureVerified"
                checked={signatureVerified}
                onChange={(e) => setSignatureVerified(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="signatureVerified" className="cursor-pointer">
                Signature verified
              </Label>
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Check Images</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="frontImage">Front Image</Label>
                <div className="mt-2">
                  <label 
                    htmlFor="frontImage" 
                    className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/50"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">
                      {frontImageFile ? frontImageFile.name : 'Upload front image'}
                    </span>
                  </label>
                  <input
                    id="frontImage"
                    type="file"
                    accept="image/*"
                    onChange={handleFrontImageChange}
                    className="hidden"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="backImage">Back Image</Label>
                <div className="mt-2">
                  <label 
                    htmlFor="backImage" 
                    className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/50"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">
                      {backImageFile ? backImageFile.name : 'Upload back image'}
                    </span>
                  </label>
                  <input
                    id="backImage"
                    type="file"
                    accept="image/*"
                    onChange={handleBackImageChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Amount Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Check Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(parseFloat(amount))}
                </span>
              </div>
              {holdType !== 'none' && (
                <div className="text-sm text-muted-foreground mt-1">
                  Hold: {holdType.replace(/_/g, ' ')} - Funds available in {
                    holdType === 'standard' ? '2' : 
                    holdType === 'extended' || holdType === 'large_check' ? '7' : '10'
                  } days
                </div>
              )}
            </div>
          )}

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
              disabled={loading || !accountNumber || !checkNumber || !amount || !payerName}
              className="flex-1"
            >
              {loading ? 'Processing...' : 'Process Check Deposit'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAccountNumber('');
                setCustomerName('');
                setCheckNumber('');
                setCheckDate('');
                setAmount('');
                setPayerName('');
                setPayerBank('');
                setPayerBankCode('');
                setPayerAccount('');
                setHoldType('standard');
                setSignatureVerified(false);
                setFrontImageFile(null);
                setBackImageFile(null);
                setNotes('');
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
