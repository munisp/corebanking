import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';
import './RiskAlertsScreen.css';

type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

interface RiskAlert {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  category: string;
  date: string;
  acknowledged: boolean;
  affectedArea?: string;
}

const RiskAlertsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<RiskAlert[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (selectedSeverity === 'all') {
      setFilteredAlerts(alerts);
    } else {
      setFilteredAlerts(alerts.filter(alert => alert.severity === selectedSeverity));
    }
  }, [selectedSeverity, alerts]);

  const fetchAlerts = async () => {
    try {
      const riskAlerts = await agricultureService.getRiskAlerts();
      const mapped = riskAlerts.map((alert) => ({
        id: alert.id,
        title: `${alert.severity.toUpperCase()} Risk Alert`,
        description: alert.message,
        severity: alert.severity,
        category: alert.cropType || 'portfolio',
        date: alert.createdAt?.toISOString?.() || new Date().toISOString(),
        acknowledged: alert.acknowledged,
        affectedArea: alert.farmerName || undefined,
      }));
      setAlerts(mapped);
      setFilteredAlerts(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await agricultureService.acknowledgeRiskAlert(alertId);
      setAlerts(alerts.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ));
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const getSeverityColor = (severity: RiskSeverity): string => {
    switch (severity) {
      case 'low':
        return '#4caf50';
      case 'medium':
        return '#ffc107';
      case 'high':
        return '#ff9800';
      case 'critical':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getSeverityIcon = (severity: RiskSeverity): string => {
    switch (severity) {
      case 'low':
        return 'ℹ';
      case 'medium':
        return '⚠';
      case 'high':
        return '⚠';
      case 'critical':
        return '🚨';
      default:
        return '•';
    }
  };

  if (isLoading) {
    return (
      <div className="risk-alerts-screen">
        <div className="loading">Loading risk alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="risk-alerts-screen">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="risk-alerts-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Risk Alerts</h1>
      </div>

      <div className="content">
        <div className="filters">
          <div className="filter-group">
            <label>Filter by Severity:</label>
            <div className="severity-filters">
              <button
                className={`filter-chip ${selectedSeverity === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedSeverity('all')}
              >
                All ({alerts.length})
              </button>
              <button
                className={`filter-chip low ${selectedSeverity === 'low' ? 'active' : ''}`}
                onClick={() => setSelectedSeverity('low')}
              >
                Low ({alerts.filter(a => a.severity === 'low').length})
              </button>
              <button
                className={`filter-chip medium ${selectedSeverity === 'medium' ? 'active' : ''}`}
                onClick={() => setSelectedSeverity('medium')}
              >
                Medium ({alerts.filter(a => a.severity === 'medium').length})
              </button>
              <button
                className={`filter-chip high ${selectedSeverity === 'high' ? 'active' : ''}`}
                onClick={() => setSelectedSeverity('high')}
              >
                High ({alerts.filter(a => a.severity === 'high').length})
              </button>
              <button
                className={`filter-chip critical ${selectedSeverity === 'critical' ? 'active' : ''}`}
                onClick={() => setSelectedSeverity('critical')}
              >
                Critical ({alerts.filter(a => a.severity === 'critical').length})
              </button>
            </div>
          </div>
        </div>

        <div className="alerts-list">
          {filteredAlerts.length === 0 ? (
            <div className="no-alerts">
              <p>No risk alerts found for the selected filter.</p>
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div 
                key={alert.id} 
                className={`alert-card ${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''}`}
              >
                <div className="alert-header">
                  <div className="alert-icon" style={{ color: getSeverityColor(alert.severity) }}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="alert-title-section">
                    <h3 className="alert-title">{alert.title}</h3>
                    <div className="alert-meta">
                      <span className="alert-category">{alert.category}</span>
                      <span className="alert-date">{new Date(alert.date).toLocaleDateString()}</span>
                      {alert.affectedArea && (
                        <span className="alert-area">📍 {alert.affectedArea}</span>
                      )}
                    </div>
                  </div>
                  <div 
                    className="severity-badge" 
                    style={{ background: getSeverityColor(alert.severity) }}
                  >
                    {alert.severity.toUpperCase()}
                  </div>
                </div>

                <div className="alert-description">
                  {alert.description}
                </div>

                {!alert.acknowledged && (
                  <div className="alert-actions">
                    <button 
                      className="acknowledge-btn"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge Alert
                    </button>
                  </div>
                )}

                {alert.acknowledged && (
                  <div className="acknowledged-badge">
                    ✓ Acknowledged
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskAlertsScreen;
