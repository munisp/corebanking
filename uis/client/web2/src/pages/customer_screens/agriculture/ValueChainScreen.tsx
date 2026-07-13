import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';
import './ValueChainScreen.css';

type PartnerCategory = 'input_suppliers' | 'aggregators' | 'processors' | 'offtakers';

interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  description: string;
  services: string[];
  isActive: boolean;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  location?: string;
}

const ValueChainScreen: React.FC = () => {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredPartners(partners);
    } else {
      setFilteredPartners(partners.filter(partner => partner.category === selectedCategory));
    }
  }, [selectedCategory, partners]);

  const fetchPartners = async () => {
    try {
      const data = await agricultureService.getPartners();
      const mapped: Partner[] = data.map((partner) => ({
        id: partner.id,
        name: partner.name,
        category: ((partner.category || 'aggregators') as PartnerCategory),
        description: `${partner.type || 'Partner'} in ${partner.location || 'agriculture value chain'}`,
        services: partner.services || [],
        isActive: partner.status === 'active',
        contactPerson: partner.contactPerson,
        phoneNumber: partner.phoneNumber,
        email: partner.email,
        location: partner.location,
      }));
      setPartners(mapped);
      setFilteredPartners(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryLabel = (category: PartnerCategory): string => {
    const labels: Record<PartnerCategory, string> = {
      input_suppliers: 'Input Suppliers',
      aggregators: 'Aggregators',
      processors: 'Processors',
      offtakers: 'Offtakers'
    };
    return labels[category];
  };

  const getCategoryIcon = (category: PartnerCategory): string => {
    const icons: Record<PartnerCategory, string> = {
      input_suppliers: '🌱',
      aggregators: '📦',
      processors: '🏭',
      offtakers: '🚛'
    };
    return icons[category];
  };

  if (isLoading) {
    return (
      <div className="value-chain-screen">
        <div className="loading">Loading value chain partners...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="value-chain-screen">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="value-chain-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Value Chain Partners</h1>
      </div>

      <div className="content">
        <div className="filters">
          <div className="filter-group">
            <label>Filter by Category:</label>
            <div className="category-filters">
              <button
                className={`filter-chip ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All ({partners.length})
              </button>
              <button
                className={`filter-chip ${selectedCategory === 'input_suppliers' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('input_suppliers')}
              >
                🌱 Input Suppliers ({partners.filter(p => p.category === 'input_suppliers').length})
              </button>
              <button
                className={`filter-chip ${selectedCategory === 'aggregators' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('aggregators')}
              >
                📦 Aggregators ({partners.filter(p => p.category === 'aggregators').length})
              </button>
              <button
                className={`filter-chip ${selectedCategory === 'processors' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('processors')}
              >
                🏭 Processors ({partners.filter(p => p.category === 'processors').length})
              </button>
              <button
                className={`filter-chip ${selectedCategory === 'offtakers' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('offtakers')}
              >
                🚛 Offtakers ({partners.filter(p => p.category === 'offtakers').length})
              </button>
            </div>
          </div>
        </div>

        <div className="partners-list">
          {filteredPartners.length === 0 ? (
            <div className="no-partners">
              <p>No partners found for the selected category.</p>
            </div>
          ) : (
            filteredPartners.map(partner => (
              <div key={partner.id} className={`partner-card ${!partner.isActive ? 'inactive' : ''}`}>
                <div className="partner-header">
                  <div className="partner-icon">
                    {getCategoryIcon(partner.category)}
                  </div>
                  <div className="partner-info">
                    <h3 className="partner-name">{partner.name}</h3>
                    <div className="partner-meta">
                      <span className="partner-category">{getCategoryLabel(partner.category)}</span>
                      <span className={`partner-status ${partner.isActive ? 'active' : 'inactive'}`}>
                        {partner.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="partner-description">
                  {partner.description}
                </div>

                {partner.services && partner.services.length > 0 && (
                  <div className="partner-services">
                    <div className="services-label">Services:</div>
                    <div className="services-list">
                      {partner.services.map((service, index) => (
                        <span key={index} className="service-chip">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(partner.contactPerson || partner.phoneNumber || partner.email || partner.location) && (
                  <div className="partner-contact">
                    {partner.contactPerson && (
                      <div className="contact-item">
                        <span className="contact-icon">👤</span>
                        <span>{partner.contactPerson}</span>
                      </div>
                    )}
                    {partner.phoneNumber && (
                      <div className="contact-item">
                        <span className="contact-icon">📞</span>
                        <span>{partner.phoneNumber}</span>
                      </div>
                    )}
                    {partner.email && (
                      <div className="contact-item">
                        <span className="contact-icon">✉️</span>
                        <span>{partner.email}</span>
                      </div>
                    )}
                    {partner.location && (
                      <div className="contact-item">
                        <span className="contact-icon">📍</span>
                        <span>{partner.location}</span>
                      </div>
                    )}
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

export default ValueChainScreen;
