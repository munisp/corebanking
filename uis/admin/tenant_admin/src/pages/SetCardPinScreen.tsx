import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const SetCardPinScreen: React.FC = () => {
  const [cardId, setCardId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/v1/cards/${cardId}/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data));
    } catch (err) {
      setResult('Error setting card PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit} autoComplete="off">
          <CardHeader>
            <CardTitle>Set Card PIN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cardId">Card ID</Label>
              <Input id="cardId" type="text" value={cardId} onChange={e => setCardId(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="pin">New PIN</Label>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Set PIN'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SetCardPinScreen;
