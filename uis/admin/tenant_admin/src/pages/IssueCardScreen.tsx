import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const IssueCardScreen: React.FC = () => {
  const [accountId, setAccountId] = useState('');
  const [cardType, setCardType] = useState('virtual');
  const [nameOnCard, setNameOnCard] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/v1/cards/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          card_type: cardType,
          name_on_card: nameOnCard,
        }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data));
    } catch (err) {
      setResult('Error issuing card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit} autoComplete="off">
          <CardHeader>
            <CardTitle>Issue Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="accountId">Account ID</Label>
              <Input id="accountId" type="text" value={accountId} onChange={e => setAccountId(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="cardType">Card Type</Label>
              <select id="cardType" className="w-full h-9 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs" value={cardType} onChange={e => setCardType(e.target.value)}>
                <option value="virtual">Virtual</option>
                <option value="physical">Physical</option>
              </select>
            </div>
            <div>
              <Label htmlFor="nameOnCard">Name on Card</Label>
              <Input id="nameOnCard" type="text" value={nameOnCard} onChange={e => setNameOnCard(e.target.value)} required maxLength={50} />
            </div>
            {result && (
              <div className="bg-muted rounded p-2 text-xs mt-2">
                <strong>Result:</strong>
                <pre className="whitespace-pre-wrap break-all">{result}</pre>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Issue Card'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default IssueCardScreen;
