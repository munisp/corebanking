import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';
import './ProactiveRiskScreen.css';

interface RiskData {
  overallRisk: number;
  weatherRisk: number;
  marketRisk: number;
  creditRisk: number;
  riskIndicators: {
    drought: number;
    flood: number;
    pest: number;
    priceVolatility: number;
  };
  mitigationStrategies: string[];
}

const ProactiveRiskScreen: React.FC = () => {
  const navigate = useNavigate();
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRiskData();
  }, []);

  const fetchRiskData = async () => {
    try {
      const [riskSummary, alerts] = await Promise.all([
        agricultureService.getProactiveRiskData(),
        agricultureService.getRiskAlerts(),
      ]);

      const highAlerts = alerts.filter((alert) => alert.severity === 'high' || alert.severity === 'critical').length;
      const mediumAlerts = alerts.filter((alert) => alert.severity === 'medium').length;

      const riskDistribution = ((riskSummary as Record<string, unknown>).risk_distribution || []) as Array<Record<string, unknown>>;
      const exposureTotal = riskDistribution.reduce((sum, item) => sum + Number(item.exposure || 0), 0);

      const data: RiskData = {
        overallRisk: Math.min(100, 20 + highAlerts * 12 + mediumAlerts * 6),
        weatherRisk: Math.min(100, 25 + highAlerts * 10),
        marketRisk: Math.min(100, 20 + mediumAlerts * 8),
        creditRisk: Math.min(100, exposureTotal > 0 ? 55 : 25),
        riskIndicators: {
          drought: Math.min(100, 15 + highAlerts * 10),
          flood: Math.min(100, 10 + mediumAlerts * 12),
          pest: Math.min(100, 12 + highAlerts * 8),
          priceVolatility: Math.min(100, 20 + mediumAlerts * 9),
        },
        mitigationStrategies: [
          'Diversify crop portfolio across low and medium risk zones',
          'Schedule proactive farmer engagement for high-exposure regions',
          'Run weather advisory notifications before critical planting windows',
          'Increase monitoring cadence for portfolios with elevated outstanding balance',
        ],
      };
      setRiskData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskLevel = (score: number): string => {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  };

  const getRiskColor = (score: number): string => {
    if (score >= 75) return '#f44336';
    if (score >= 50) return '#ff9800';
    if (score >= 25) return '#ffc107';
    return '#4caf50';
  };

  if (isLoading) {
    return (
      <div className="proactive-risk-screen">
        <div className="loading">Loading risk assessment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="proactive-risk-screen">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="proactive-risk-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Proactive Risk Management</h1>
      </div>

      {riskData && (
        <div className="content">
          <section className="risk-overview">
            <h2>Risk Overview</h2>
            <div className="overall-risk-card">
              <div className="risk-circle" style={{ borderColor: getRiskColor(riskData.overallRisk) }}>
                <div className="risk-score">{riskData.overallRisk}</div>
                <div className="risk-label">Overall Risk</div>
              </div>
              <div className={`risk-status ${getRiskLevel(riskData.overallRisk)}`}>
                {getRiskLevel(riskData.overallRisk).toUpperCase()}
              </div>
            </div>
          </section>

          <section className="risk-categories">
            <h2>Risk Categories</h2>
            <div className="categories-grid">
              <div className="category-card">
                <div className="category-header">
                  <span className="category-icon">🌦️</span>
                  <span className="category-name">Weather Risk</span>
                </div>
                <div className="risk-bar">
                  <div 
                    className="risk-fill" 
                    style={{ 
                      width: `${riskData.weatherRisk}%`,
                      background: getRiskColor(riskData.weatherRisk)
                    }}
                  ></div>
                </div>
                <div className="category-score">{riskData.weatherRisk}%</div>
              </div>

              <div className="category-card">
                <div className="category-header">
                  <span className="category-icon">📊</span>
                  <span className="category-name">Market Risk</span>
                </div>
                <div className="risk-bar">
                  <div 
                    className="risk-fill" 
                    style={{ 
                      width: `${riskData.marketRisk}%`,
                      background: getRiskColor(riskData.marketRisk)
                    }}
                  ></div>
                </div>
                <div className="category-score">{riskData.marketRisk}%</div>
              </div>

              <div className="category-card">
                <div className="category-header">
                  <span className="category-icon">💰</span>
                  <span className="category-name">Credit Risk</span>
                </div>
                <div className="risk-bar">
                  <div 
                    className="risk-fill" 
                    style={{ 
                      width: `${riskData.creditRisk}%`,
                      background: getRiskColor(riskData.creditRisk)
                    }}
                  ></div>
                </div>
                <div className="category-score">{riskData.creditRisk}%</div>
              </div>
            </div>
          </section>

          <section className="risk-indicators">
            <h2>Risk Indicators</h2>
            <div className="indicators-grid">
              <div className="indicator-card">
                <div className="indicator-name">Drought Risk</div>
                <div className="indicator-meter">
                  <div 
                    className="meter-fill"
                    style={{ 
                      width: `${riskData.riskIndicators.drought}%`,
                      background: getRiskColor(riskData.riskIndicators.drought)
                    }}
                  ></div>
                </div>
                <div className="indicator-value">{riskData.riskIndicators.drought}%</div>
              </div>

              <div className="indicator-card">
                <div className="indicator-name">Flood Risk</div>
                <div className="indicator-meter">
                  <div 
                    className="meter-fill"
                    style={{ 
                      width: `${riskData.riskIndicators.flood}%`,
                      background: getRiskColor(riskData.riskIndicators.flood)
                    }}
                  ></div>
                </div>
                <div className="indicator-value">{riskData.riskIndicators.flood}%</div>
              </div>

              <div className="indicator-card">
                <div className="indicator-name">Pest & Disease</div>
                <div className="indicator-meter">
                  <div 
                    className="meter-fill"
                    style={{ 
                      width: `${riskData.riskIndicators.pest}%`,
                      background: getRiskColor(riskData.riskIndicators.pest)
                    }}
                  ></div>
                </div>
                <div className="indicator-value">{riskData.riskIndicators.pest}%</div>
              </div>

              <div className="indicator-card">
                <div className="indicator-name">Price Volatility</div>
                <div className="indicator-meter">
                  <div 
                    className="meter-fill"
                    style={{ 
                      width: `${riskData.riskIndicators.priceVolatility}%`,
                      background: getRiskColor(riskData.riskIndicators.priceVolatility)
                    }}
                  ></div>
                </div>
                <div className="indicator-value">{riskData.riskIndicators.priceVolatility}%</div>
              </div>
            </div>
          </section>

          <section className="mitigation-strategies">
            <h2>Mitigation Strategies</h2>
            <div className="strategies-list">
              {riskData.mitigationStrategies.map((strategy, index) => (
                <div key={index} className="strategy-item">
                  <div className="strategy-icon">✓</div>
                  <div className="strategy-text">{strategy}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ProactiveRiskScreen;
