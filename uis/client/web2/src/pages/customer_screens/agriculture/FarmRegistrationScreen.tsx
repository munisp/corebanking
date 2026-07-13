import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';
import './FarmRegistrationScreen.css';

interface Farmer {
  id: string;
  name: string;
}

interface FarmData {
  farmerId: string;
  location: string;
  size: string;
  soilType: string;
  irrigationType: string;
  landTitleNumber: string;
  currentCrop: string;
  coordinates: {
    latitude: string;
    longitude: string;
  };
}

const FarmRegistrationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [formData, setFormData] = useState<FarmData>({
    farmerId: '',
    location: '',
    size: '',
    soilType: '',
    irrigationType: '',
    landTitleNumber: '',
    currentCrop: '',
    coordinates: {
      latitude: '',
      longitude: ''
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    try {
      const data = await agricultureService.getFarmers();
      setFarmers(data.map((farmer) => ({ id: farmer.id, name: farmer.name })));
    } catch (err) {
      console.error('Error fetching farmers:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'latitude' || name === 'longitude') {
      setFormData(prev => ({
        ...prev,
        coordinates: {
          ...prev.coordinates,
          [name]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.farmerId || !formData.location || !formData.size) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const locationParts = formData.location.split(',').map((part) => part.trim());
      const data = await agricultureService.registerFarm({
        farmer_id: formData.farmerId,
        farm_name: `${locationParts[0] || 'Farm'} Plot`,
        location: formData.location,
        state: locationParts[0] || '',
        lga: locationParts[1] || '',
        size: Number(formData.size || 0),
        soil_type: formData.soilType,
        irrigation_type: formData.irrigationType,
        land_title_number: formData.landTitleNumber,
        current_crop: formData.currentCrop,
        gps_coordinates:
          formData.coordinates.latitude && formData.coordinates.longitude
            ? `${formData.coordinates.latitude},${formData.coordinates.longitude}`
            : undefined,
      });
      console.log('Farm registered:', data);
      
      navigate('/customer/agriculture/farms');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="farm-registration-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Farm Registration</h1>
      </div>

      <div className="registration-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-section">
            <h2>Farmer Selection</h2>
            
            <div className="form-group">
              <label>Select Farmer *</label>
              <select
                name="farmerId"
                value={formData.farmerId}
                onChange={handleInputChange}
                required
              >
                <option value="">-- Select a farmer --</option>
                {farmers.map(farmer => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h2>Farm Details</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Location *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="State, LGA, Community"
                  required
                />
              </div>

              <div className="form-group">
                <label>Size (hectares) *</label>
                <input
                  type="number"
                  name="size"
                  value={formData.size}
                  onChange={handleInputChange}
                  step="0.1"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Soil Type</label>
                <select
                  name="soilType"
                  value={formData.soilType}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select soil type --</option>
                  <option value="clay">Clay</option>
                  <option value="sandy">Sandy</option>
                  <option value="loamy">Loamy</option>
                  <option value="silt">Silt</option>
                  <option value="peat">Peat</option>
                  <option value="chalk">Chalk</option>
                </select>
              </div>

              <div className="form-group">
                <label>Irrigation Type</label>
                <select
                  name="irrigationType"
                  value={formData.irrigationType}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select irrigation --</option>
                  <option value="none">None (Rain-fed)</option>
                  <option value="drip">Drip Irrigation</option>
                  <option value="sprinkler">Sprinkler</option>
                  <option value="surface">Surface Irrigation</option>
                  <option value="subsurface">Subsurface</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Land Title Number</label>
                <input
                  type="text"
                  name="landTitleNumber"
                  value={formData.landTitleNumber}
                  onChange={handleInputChange}
                  placeholder="Certificate of Occupancy number"
                />
              </div>

              <div className="form-group">
                <label>Current Crop</label>
                <input
                  type="text"
                  name="currentCrop"
                  value={formData.currentCrop}
                  onChange={handleInputChange}
                  placeholder="e.g., Maize, Rice, Cassava"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>GPS Coordinates (Optional)</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="text"
                  name="latitude"
                  value={formData.coordinates.latitude}
                  onChange={handleInputChange}
                  placeholder="e.g., 9.0765"
                />
              </div>

              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="text"
                  name="longitude"
                  value={formData.coordinates.longitude}
                  onChange={handleInputChange}
                  placeholder="e.g., 7.3986"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Registering...' : 'Register Farm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FarmRegistrationScreen;
