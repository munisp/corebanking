import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';
import './FarmerRegistrationScreen.css';

interface FarmerData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  bvn: string;
  farmSize: string;
  location: string;
  cropsGrown: string[];
  yearsOfExperience: string;
}

const FarmerRegistrationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FarmerData>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    bvn: '',
    farmSize: '',
    location: '',
    cropsGrown: [],
    yearsOfExperience: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cropInput, setCropInput] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddCrop = () => {
    if (cropInput.trim() && !formData.cropsGrown.includes(cropInput.trim())) {
      setFormData(prev => ({
        ...prev,
        cropsGrown: [...prev.cropsGrown, cropInput.trim()]
      }));
      setCropInput('');
    }
  };

  const handleRemoveCrop = (crop: string) => {
    setFormData(prev => ({
      ...prev,
      cropsGrown: prev.cropsGrown.filter(c => c !== crop)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.phoneNumber) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const locationParts = formData.location.split(',').map((part) => part.trim());

      const data = await agricultureService.registerFarmer({
        full_name: fullName,
        phone_number: formData.phoneNumber,
        email: formData.email,
        bvn: formData.bvn,
        farm_location: formData.location,
        state: locationParts[0] || '',
        lga: locationParts[1] || '',
        farm_size: Number(formData.farmSize || 0),
        crops_grown: formData.cropsGrown,
        years_experience: Number(formData.yearsOfExperience || 0),
        kyc_verified: false,
      });
      console.log('Farmer registered:', data);
      
      // Navigate to farmers list or success page
      navigate('/customer/agriculture/farmers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="farmer-registration-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Farmer Registration</h1>
      </div>

      <div className="registration-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-section">
            <h2>Personal Information</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>BVN</label>
              <input
                type="text"
                name="bvn"
                value={formData.bvn}
                onChange={handleInputChange}
                maxLength={11}
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Farm Information</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Farm Size (hectares)</label>
                <input
                  type="number"
                  name="farmSize"
                  value={formData.farmSize}
                  onChange={handleInputChange}
                  step="0.1"
                />
              </div>

              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  name="yearsOfExperience"
                  value={formData.yearsOfExperience}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="State, LGA"
              />
            </div>

            <div className="form-group">
              <label>Crops Grown</label>
              <div className="crop-input-container">
                <input
                  type="text"
                  value={cropInput}
                  onChange={(e) => setCropInput(e.target.value)}
                  placeholder="Enter crop name"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCrop())}
                />
                <button type="button" onClick={handleAddCrop} className="add-crop-btn">
                  Add
                </button>
              </div>
              <div className="crops-list">
                {formData.cropsGrown.map((crop, index) => (
                  <div key={index} className="crop-chip">
                    {crop}
                    <button type="button" onClick={() => handleRemoveCrop(crop)}>×</button>
                  </div>
                ))}
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
              {isLoading ? 'Registering...' : 'Register Farmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FarmerRegistrationScreen;
