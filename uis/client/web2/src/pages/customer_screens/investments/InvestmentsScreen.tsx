import React, { useCallback, useEffect, useState } from 'react';
import '../../../App.css';
import { AppConfig } from '../../../config/app_config';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import { apiService } from '../../../services/api_service';

interface Investment {
  id: string;
  userId: string;
  investmentType: 'stocks' | 'bonds' | 'mutual_funds' | 'real_estate' | 'cryptocurrency';
  name: string;
  symbol?: string;
  units: number;
  purchasePrice: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  status: 'active' | 'sold' | 'pending';
  purchaseDate: Date;
  createdAt: Date;
}

const InvestmentsScreen: React.FC = () => {
  const { user } = useAuth();
  const { isFeatureEnabled } = useTenantConfig();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Create form state
  const [investmentType, setInvestmentType] = useState<Investment['investmentType']>('stocks');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [units, setUnits] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  // Portfolio summary
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [totalProfitLoss, setTotalProfitLoss] = useState(0);

  const loadInvestments = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await apiService.get(`${AppConfig.investmentEndpoint}?user_id=${user.id}`);
      const data = response.data as any;
      if (data && data.success) {
        const investmentsData = data.data as Record<string, unknown>[];
        setInvestments(
          investmentsData.map((inv) => ({
            id: inv.id as string,
            userId: inv.user_id as string,
            investmentType: inv.investment_type as Investment['investmentType'],
            name: inv.name as string,
            symbol: inv.symbol as string | undefined,
            units: inv.units as number,
            purchasePrice: inv.purchase_price as number,
            currentPrice: inv.current_price as number,
            totalValue: inv.total_value as number,
            profitLoss: inv.profit_loss as number,
            profitLossPercentage: inv.profit_loss_percentage as number,
            status: inv.status as Investment['status'],
            purchaseDate: new Date(inv.purchase_date as string),
            createdAt: new Date(inv.created_at as string),
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load investments:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const calculatePortfolioSummary = useCallback(() => {
    const invested = investments.reduce((sum, inv) => sum + inv.purchasePrice * inv.units, 0);
    const value = investments.reduce((sum, inv) => sum + inv.totalValue, 0);
    const pl = value - invested;

    setTotalInvested(invested);
    setTotalValue(value);
    setTotalProfitLoss(pl);
  }, [investments]);

  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);

  useEffect(() => {
    calculatePortfolioSummary();
  }, [calculatePortfolioSummary]);

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setCreateLoading(true);
      const response = await apiService.post(AppConfig.investmentEndpoint, {
        user_id: user.id,
        investment_type: investmentType,
        name,
        symbol: symbol || undefined,
        units: parseFloat(units),
        purchase_price: parseFloat(purchasePrice),
      });

      const data = response.data as { success?: boolean; message?: string };
      if (data && data.success) {
        alert('Investment added successfully!');
        setShowCreateModal(false);
        loadInvestments();
        // Reset form
        setInvestmentType('stocks');
        setName('');
        setSymbol('');
        setUnits('');
        setPurchasePrice('');
      } else {
        alert((data && data.message) || 'Failed to add investment');
      }
    } catch {
      alert('Error adding investment');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSellInvestment = async (investmentId: string) => {
    if (!window.confirm('Are you sure you want to sell this investment?')) return;

    try {
      const response = await apiService.post(`${AppConfig.investmentEndpoint}/${investmentId}/sell`);
      const data = response.data as { success?: boolean; message?: string };
      if (data && data.success) {
        alert('Investment sold successfully');
        loadInvestments();
      } else {
        alert((data && data.message) || 'Failed to sell investment');
      }
    } catch {
      alert('Error selling investment');
    }
  };

  const getTypeColor = (type: Investment['investmentType']) => {
    switch (type) {
      case 'stocks':
        return '#2196F3';
      case 'bonds':
        return '#4CAF50';
      case 'mutual_funds':
        return '#FF9800';
      case 'real_estate':
        return '#9C27B0';
      case 'cryptocurrency':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  if (!isFeatureEnabled('investment')) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
        <h2 style={{ marginBottom: '8px', color: '#333' }}>Investments Not Available</h2>
        <p style={{ color: '#666', maxWidth: '300px' }}>The investment feature is not enabled for your account. Contact support to enable this feature.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading investments...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Investments</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Add Investment
        </button>
      </div>

      {/* Portfolio Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ color: '#666', marginBottom: '8px' }}>Total Invested</p>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#007bff', margin: 0 }}>
            ₦{totalInvested.toLocaleString()}
          </p>
        </div>
        <div
          style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ color: '#666', marginBottom: '8px' }}>Current Value</p>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#4CAF50', margin: 0 }}>
            ₦{totalValue.toLocaleString()}
          </p>
        </div>
        <div
          style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ color: '#666', marginBottom: '8px' }}>Profit/Loss</p>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: totalProfitLoss >= 0 ? '#4CAF50' : '#F44336',
              margin: 0,
            }}
          >
            {totalProfitLoss >= 0 ? '+' : ''}₦{totalProfitLoss.toLocaleString()}
          </p>
        </div>
      </div>

      {investments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No investments found. Add an investment to start tracking your portfolio.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {investments.map((investment) => (
            <div
              key={investment.id}
              style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, marginBottom: '4px' }}>
                    {investment.name} {investment.symbol && `(${investment.symbol})`}
                  </h3>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'white',
                      backgroundColor: getTypeColor(investment.investmentType),
                    }}
                  >
                    {investment.investmentType.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: investment.status === 'active' ? '#4CAF50' : '#9E9E9E',
                  }}
                >
                  {investment.status.toUpperCase()}
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>Current Value</p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#007bff', margin: 0 }}>
                  ₦{investment.totalValue.toLocaleString()}
                </p>
              </div>

              <div style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Units:</span>
                  <strong>{investment.units}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Purchase Price:</span>
                  <strong>₦{investment.purchasePrice.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Current Price:</span>
                  <strong>₦{investment.currentPrice.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Profit/Loss:</span>
                  <strong style={{ color: investment.profitLoss >= 0 ? '#4CAF50' : '#F44336' }}>
                    {investment.profitLoss >= 0 ? '+' : ''}₦{investment.profitLoss.toLocaleString()} (
                    {investment.profitLossPercentage.toFixed(2)}%)
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Purchase Date:</span>
                  <strong>{new Date(investment.purchaseDate).toLocaleDateString()}</strong>
                </div>
              </div>

              {investment.status === 'active' && (
                <button
                  onClick={() => handleSellInvestment(investment.id)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Sell Investment
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Investment Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>Add Investment</h2>
            <form onSubmit={handleCreateInvestment}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Investment Type
                </label>
                <select
                  value={investmentType}
                  onChange={(e) => setInvestmentType(e.target.value as Investment['investmentType'])}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                >
                  <option value="stocks">Stocks</option>
                  <option value="bonds">Bonds</option>
                  <option value="mutual_funds">Mutual Funds</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="cryptocurrency">Cryptocurrency</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Apple Inc., Bitcoin"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Symbol (Optional)
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g., AAPL, BTC"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Number of Units
                </label>
                <input
                  type="number"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="0"
                  required
                  min="0"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Purchase Price per Unit
                </label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0.00"
                  required
                  min="0"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: createLoading ? '#cccccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: createLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                  }}
                >
                  {createLoading ? 'Adding...' : 'Add Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentsScreen;
