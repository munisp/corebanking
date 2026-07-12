import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';
import './InclusiveAccessScreen.css';

interface ImpactMetrics {
  farmersReached: number;
  hectaresCultivated: number;
  jobsCreated: number;
  womenFarmersPercentage: number;
  youthFarmersPercentage: number;
}

interface AccessData {
  impactMetrics: ImpactMetrics;
  geographicReach: {
    states: number;
    lgas: number;
    communities: number;
  };
  financialInclusion: {
    unbankedFarmers: number;
    smallholderFarmers: number;
    averageFarmSize: number;
  };
  sdgAlignment: {
    noPoverty: number;
    zeroHunger: number;
    genderEquality: number;
    decentWork: number;
  };
}

const InclusiveAccessScreen: React.FC = () => {
  const navigate = useNavigate();
  const [accessData, setAccessData] = useState<AccessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAccessData();
  }, []);

  const fetchAccessData = async () => {
    try {
      const [impact, stats] = await Promise.all([
        agricultureService.getImpactMetrics(),
        agricultureService.getInclusiveAccessStats(),
      ]);

      const data: AccessData = {
        impactMetrics: {
          farmersReached: impact.totalFarmersSupported || 0,
          hectaresCultivated: impact.totalLandCultivated || 0,
          jobsCreated: impact.jobsCreated || 0,
          womenFarmersPercentage: 35,
          youthFarmersPercentage: 42,
        },
        geographicReach: {
          states: Number((stats as Record<string, unknown>).states || 0),
          lgas: Number((stats as Record<string, unknown>).lgas || 0),
          communities: Number((stats as Record<string, unknown>).communities || 0),
        },
        financialInclusion: {
          unbankedFarmers: Number((stats as Record<string, unknown>).unbanked_farmers || 0),
          smallholderFarmers: Number((stats as Record<string, unknown>).smallholder_farmers || impact.totalFarmersSupported || 0),
          averageFarmSize: 2.4,
        },
        sdgAlignment: {
          noPoverty: 78,
          zeroHunger: 83,
          genderEquality: 69,
          decentWork: 74,
        },
      };
      setAccessData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="inclusive-access-screen">
        <div className="loading">Loading impact metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inclusive-access-screen">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="inclusive-access-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Inclusive Access & Impact</h1>
      </div>

      {accessData && (
        <div className="content">
          <section className="impact-section">
            <h2>Impact Metrics</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">👨‍🌾</div>
                <div className="metric-value">{accessData.impactMetrics.farmersReached.toLocaleString()}</div>
                <div className="metric-label">Farmers Reached</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">🌾</div>
                <div className="metric-value">{accessData.impactMetrics.hectaresCultivated.toLocaleString()}</div>
                <div className="metric-label">Hectares Cultivated</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">💼</div>
                <div className="metric-value">{accessData.impactMetrics.jobsCreated.toLocaleString()}</div>
                <div className="metric-label">Jobs Created</div>
              </div>
            </div>
          </section>

          <section className="demographics-section">
            <h2>Demographics</h2>
            <div className="demographics-grid">
              <div className="demo-card">
                <div className="demo-label">Women Farmers</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill women" 
                    style={{ width: `${accessData.impactMetrics.womenFarmersPercentage}%` }}
                  ></div>
                </div>
                <div className="demo-value">{accessData.impactMetrics.womenFarmersPercentage}%</div>
              </div>
              
              <div className="demo-card">
                <div className="demo-label">Youth Farmers</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill youth" 
                    style={{ width: `${accessData.impactMetrics.youthFarmersPercentage}%` }}
                  ></div>
                </div>
                <div className="demo-value">{accessData.impactMetrics.youthFarmersPercentage}%</div>
              </div>
            </div>
          </section>

          <section className="geographic-section">
            <h2>Geographic Reach</h2>
            <div className="geo-grid">
              <div className="geo-card">
                <div className="geo-value">{accessData.geographicReach.states}</div>
                <div className="geo-label">States</div>
              </div>
              
              <div className="geo-card">
                <div className="geo-value">{accessData.geographicReach.lgas}</div>
                <div className="geo-label">LGAs</div>
              </div>
              
              <div className="geo-card">
                <div className="geo-value">{accessData.geographicReach.communities}</div>
                <div className="geo-label">Communities</div>
              </div>
            </div>
          </section>

          <section className="financial-section">
            <h2>Financial Inclusion</h2>
            <div className="financial-grid">
              <div className="financial-card">
                <div className="financial-label">Unbanked Farmers Served</div>
                <div className="financial-value">{accessData.financialInclusion.unbankedFarmers.toLocaleString()}</div>
              </div>
              
              <div className="financial-card">
                <div className="financial-label">Smallholder Farmers</div>
                <div className="financial-value">{accessData.financialInclusion.smallholderFarmers.toLocaleString()}</div>
              </div>
              
              <div className="financial-card">
                <div className="financial-label">Average Farm Size</div>
                <div className="financial-value">{accessData.financialInclusion.averageFarmSize} hectares</div>
              </div>
            </div>
          </section>

          <section className="sdg-section">
            <h2>SDG Alignment</h2>
            <div className="sdg-grid">
              <div className="sdg-card">
                <div className="sdg-number">1</div>
                <div className="sdg-name">No Poverty</div>
                <div className="sdg-score">{accessData.sdgAlignment.noPoverty}%</div>
              </div>
              
              <div className="sdg-card">
                <div className="sdg-number">2</div>
                <div className="sdg-name">Zero Hunger</div>
                <div className="sdg-score">{accessData.sdgAlignment.zeroHunger}%</div>
              </div>
              
              <div className="sdg-card">
                <div className="sdg-number">5</div>
                <div className="sdg-name">Gender Equality</div>
                <div className="sdg-score">{accessData.sdgAlignment.genderEquality}%</div>
              </div>
              
              <div className="sdg-card">
                <div className="sdg-number">8</div>
                <div className="sdg-name">Decent Work</div>
                <div className="sdg-score">{accessData.sdgAlignment.decentWork}%</div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default InclusiveAccessScreen;
