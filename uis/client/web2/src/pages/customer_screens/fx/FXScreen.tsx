import React, { useCallback, useEffect, useState } from 'react';
import '../../../App.css';
import { AppConfig } from '../../../config/app_config';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiService } from '../../../services/api_service';

interface FXTransaction {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

const FXScreen: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const card: React.CSSProperties = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
  };

  const subCard: React.CSSProperties = {
    backgroundColor: isDark ? '#2D2D2D' : '#f8f9fa',
    borderRadius: '8px',
  };

  const textMuted: React.CSSProperties = { color: isDark ? '#B0B0B0' : '#666' };
  const textFaint: React.CSSProperties = { color: isDark ? '#808080' : '#999' };
  const textPrimary: React.CSSProperties = { color: isDark ? '#F3F4F6' : '#111' };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: `1px solid ${isDark ? '#404040' : '#ddd'}`,
    fontSize: '16px',
    backgroundColor: isDark ? '#2D2D2D' : '#fff',
    color: isDark ? '#F3F4F6' : '#111',
  };
  const [fromCurrency, setFromCurrency] = useState('NGN');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactions, setTransactions] = useState<FXTransaction[]>([]);

  const currencies = ['NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'ZAR', 'GHS', 'KES'];

  const loadTransactions = useCallback(async () => {
    if (!user) return;

    try {
      const response = await apiService.get(`${AppConfig.fxEndpoint}/transactions?user_id=${user.id}`);
      const data = response.data as { success?: boolean; data?: Record<string, unknown>[]; message?: string };
      if (data && data.success && Array.isArray(data.data)) {
        setTransactions(
          data.data.map((tx) => ({
            id: tx.id as string,
            fromCurrency: tx.from_currency as string,
            toCurrency: tx.to_currency as string,
            fromAmount: tx.from_amount as number,
            toAmount: tx.to_amount as number,
            rate: tx.rate as number,
            status: tx.status as FXTransaction['status'],
            createdAt: new Date(tx.created_at as string),
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, [user]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const fetchExchangeRate = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    try {
      setLoading(true);
      const response = await apiService.get(
        `${AppConfig.fxEndpoint}/rate?from=${fromCurrency}&to=${toCurrency}`
      );
      const data = response.data as { success?: boolean; data?: { rate: number }; message?: string };
      if (data && data.success && data.data && typeof data.data.rate === 'number') {
        setExchangeRate(data.data.rate);
        setConvertedAmount(parseFloat(amount) * data.data.rate);
      } else {
        alert((data && data.message) || 'Failed to fetch exchange rate');
      }
    } catch (error) {
      alert('Error fetching exchange rate');
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = async () => {
    if (!user || !amount || !exchangeRate) return;

    try {
      setTransactionLoading(true);
      const response = await apiService.post(`${AppConfig.fxEndpoint}/exchange`, {
        user_id: user.id,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: parseFloat(amount),
        rate: exchangeRate,
      });

      const data = response.data as any;
      if (data && data.success) {
        alert('Exchange completed successfully!');
        setAmount('');
        setExchangeRate(null);
        setConvertedAmount(null);
        loadTransactions();
      } else {
        alert((data && data.message) || 'Exchange failed');
      }
    } catch (error) {
      alert('Error processing exchange');
      console.error(error);
    } finally {
      setTransactionLoading(false);
    }
  };

  const swapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setExchangeRate(null);
    setConvertedAmount(null);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px', ...textPrimary }}>Foreign Exchange</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
        {/* Exchange Form */}
        <div style={card}>
          <h2 style={{ marginBottom: '20px', ...textPrimary }}>Exchange Currency</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', ...textPrimary }}>
              From Currency
            </label>
            <select
              value={fromCurrency}
              onChange={(e) => {
                setFromCurrency(e.target.value);
                setExchangeRate(null);
                setConvertedAmount(null);
              }}
              style={inputStyle}
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <button
              onClick={swapCurrencies}
              style={{
                padding: '10px',
                backgroundColor: isDark ? '#404040' : '#f0f0f0',
                color: isDark ? '#F3F4F6' : '#111',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '20px',
              }}
            >
              ⇅
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', ...textPrimary }}>
              To Currency
            </label>
            <select
              value={toCurrency}
              onChange={(e) => {
                setToCurrency(e.target.value);
                setExchangeRate(null);
                setConvertedAmount(null);
              }}
              style={inputStyle}
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', ...textPrimary }}>
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setExchangeRate(null);
                setConvertedAmount(null);
              }}
              placeholder="0.00"
              min="0"
              step="0.01"
              style={inputStyle}
            />
          </div>

          <button
            onClick={fetchExchangeRate}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? (isDark ? '#555' : '#cccccc') : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              marginBottom: '20px',
            }}
          >
            {loading ? 'Fetching Rate...' : 'Get Exchange Rate'}
          </button>

          {exchangeRate && convertedAmount !== null && (
            <div style={{ ...subCard, padding: '20px', marginBottom: '20px' }}>
              <p style={{ marginBottom: '8px', ...textMuted }}>Exchange Rate</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', ...textPrimary }}>
                1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency}
              </p>
              <p style={{ marginBottom: '8px', ...textMuted }}>You will receive</p>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#007bff' }}>
                {convertedAmount.toFixed(2)} {toCurrency}
              </p>
            </div>
          )}

          {exchangeRate && (
            <button
              onClick={handleExchange}
              disabled={transactionLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: transactionLoading ? (isDark ? '#555' : '#cccccc') : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: transactionLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
              }}
            >
              {transactionLoading ? 'Processing...' : 'Complete Exchange'}
            </button>
          )}
        </div>

        {/* Recent Transactions */}
        <div style={card}>
          <h2 style={{ marginBottom: '20px', ...textPrimary }}>Recent Transactions</h2>
          {transactions.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px', ...textMuted }}>
              No transactions yet
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    ...subCard,
                    padding: '16px',
                    borderLeft: `4px solid ${
                      tx.status === 'completed' ? '#28a745' : tx.status === 'pending' ? '#FFA500' : '#dc3545'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', ...textPrimary }}>
                      {tx.fromCurrency} → {tx.toCurrency}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor:
                          tx.status === 'completed' ? '#28a745' : tx.status === 'pending' ? '#FFA500' : '#dc3545',
                        color: 'white',
                      }}
                    >
                      {tx.status.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: '14px', marginBottom: '4px', ...textMuted }}>
                    {tx.fromAmount.toFixed(2)} {tx.fromCurrency} → {tx.toAmount.toFixed(2)} {tx.toCurrency}
                  </p>
                  <p style={{ fontSize: '12px', ...textFaint }}>
                    Rate: {tx.rate.toFixed(4)} | {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popular Exchange Rates */}
      <div style={card}>
        <h2 style={{ marginBottom: '20px', ...textPrimary }}>Popular Exchange Rates</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {['USD', 'EUR', 'GBP', 'JPY'].map((currency) => (
            <div key={currency} style={{ ...subCard, padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', ...textPrimary }}>
                NGN / {currency}
              </p>
              <p style={{ fontSize: '14px', ...textMuted }}>Click "Get Rate" to view current rate</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FXScreen;