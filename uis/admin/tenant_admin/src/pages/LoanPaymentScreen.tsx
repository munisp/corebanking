import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { DollarSign } from 'lucide-react';
import { useTenantBranding } from '../contexts/TenantBrandingContext';
import { BACKEND_URL } from '../const';

const LoanPaymentScreen: React.FC = () => {
  const { primaryColor } = useTenantBranding();
  const [loanId, setLoanId] = useState('');
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`${BACKEND_URL}/payment-processing/payment/loan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: loanId,
          payer: Number(payer),
          amount: Number(amount),
          pin,
        }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data));
    } catch (err) {
      setResult('Error performing loan payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8" style={{ color: primaryColor }} />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Loan Payment
              </h1>
              <p className="text-muted-foreground mt-1">
                Make a payment towards your loan
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 flex justify-center">
        <Card className="w-full max-w-2xl">
        <form onSubmit={handleSubmit} autoComplete="off">
          <CardHeader>
            <CardTitle>Loan Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="loanId">Loan ID</Label>
              <Input id="loanId" type="text" value={loanId} onChange={e => setLoanId(e.target.value)} required autoFocus />
            </div>
            <div>
              <Label htmlFor="payer">Payer ID</Label>
              <Input id="payer" type="number" value={payer} onChange={e => setPayer(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} required min={1} />
            </div>
            <div>
              <Label htmlFor="pin">PIN</Label>
              <Input id="pin" type="password" value={pin} onChange={e => setPin(e.target.value)} required minLength={4} maxLength={8} />
            </div>
            {result && (
              <div className="bg-muted rounded p-2 text-xs mt-2">
                <strong>Result:</strong>
                <pre className="whitespace-pre-wrap break-all">{result}</pre>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full text-white" 
              disabled={loading}
              style={{ backgroundColor: loading ? undefined : primaryColor }}
            >
              {loading ? 'Processing...' : 'Pay Loan'}
            </Button>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  );
};

export default LoanPaymentScreen;
