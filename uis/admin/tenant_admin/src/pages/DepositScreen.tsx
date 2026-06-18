import { ArrowDownToLine } from "lucide-react";
import { BACKEND_URL } from "../const";
import React, { useState } from "react";
import { Button } from "../components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useTenantBranding } from "../contexts/TenantBrandingContext";

const DepositScreen: React.FC = () => {
  const { primaryColor } = useTenantBranding();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/payment-processing/payment/deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: Number(recipient),
            amount: Number(amount),
            note,
          }),
        },
      );
      const data = await response.json();
      setResult(JSON.stringify(data));
    } catch (err) {
      setResult("Error performing deposit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <ArrowDownToLine
              className="w-8 h-8"
              style={{ color: primaryColor }}
            />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Deposit Funds
              </h1>
              <p className="text-muted-foreground mt-1">
                Deposit funds into an account
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 flex justify-center">
        <Card className="w-full max-w-2xl">
          <form onSubmit={handleSubmit} autoComplete="off">
            <CardHeader>
              <CardTitle>Deposit Funds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="recipient">Recipient ID</Label>
                <Input
                  id="recipient"
                  type="number"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min={1}
                />
              </div>
              <div>
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  maxLength={100}
                />
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
                {loading ? "Processing..." : "Deposit"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default DepositScreen;
