import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';
import './AgriLoanApplicationScreen.css';

interface LoanFormData {
  loanAmount: string;
  loanType: string;
  cropType: string;
  tenure: string;
  farmSize: string;
  plantingDate: string;
  expectedHarvestDate: string;
  collateralType: string;
  collateralValue: string;
  collateralDescription: string;
}

const AgriLoanApplicationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<LoanFormData>({
    loanAmount: '',
    loanType: '',
    cropType: '',
    tenure: '',
    farmSize: '',
    plantingDate: '',
    expectedHarvestDate: '',
    collateralType: '',
    collateralValue: '',
    collateralDescription: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    'Loan Details',
    'Farm Information',
    'Collateral Information',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!(formData.loanAmount && formData.loanType && formData.cropType && formData.tenure);
      case 1:
        return !!(formData.farmSize && formData.plantingDate && formData.expectedHarvestDate);
      case 2:
        return !!(formData.collateralType && formData.collateralValue);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      setError('');
    } else {
      setError('Please fill in all required fields');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const farmers = await agricultureService.getFarmers();
      if (!farmers.length) {
        throw new Error('No farmer found. Please register a farmer first.');
      }

      const selectedFarmer = farmers[0];
      const farms = await agricultureService.getFarms({ farmerId: selectedFarmer.id });
      if (!farms.length) {
        throw new Error('No farm found for the selected farmer. Please register a farm first.');
      }

      const selectedFarm = farms[0];

      await agricultureService.assessLoan({
        farmer_id: selectedFarmer.id,
        farm_id: selectedFarm.id,
        loan_type: formData.loanType,
        loan_amount: Number(formData.loanAmount || 0),
        crop_type: formData.cropType,
        planting_date: formData.plantingDate,
      });

      const data = await agricultureService.createLoan({
        farmer_id: selectedFarmer.id,
        farm_id: selectedFarm.id,
        loan_type: formData.loanType,
        loan_amount: Number(formData.loanAmount || 0),
        loan_purpose: `${formData.loanType} financing for ${formData.cropType}`,
        crop_type: formData.cropType,
        planting_date: formData.plantingDate,
        expected_harvest_date: formData.expectedHarvestDate,
        collateral_type: formData.collateralType,
        collateral_value: Number(formData.collateralValue || 0),
        tenor_days: Number(formData.tenure || 0) * 30,
      });
      console.log('Loan application submitted:', data);
      
      navigate('/customer/agriculture/loans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="step-content">
            <h2>Loan Details</h2>
            
            <div className="form-group">
              <label>Loan Amount (₦) *</label>
              <input
                type="number"
                name="loanAmount"
                value={formData.loanAmount}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Loan Type *</label>
              <select
                name="loanType"
                value={formData.loanType}
                onChange={handleInputChange}
                required
              >
                <option value="">-- Select loan type --</option>
                <option value="input">Input Loan</option>
                <option value="equipment">Equipment Loan</option>
                <option value="working_capital">Working Capital</option>
                <option value="expansion">Farm Expansion</option>
              </select>
            </div>

            <div className="form-group">
              <label>Crop Type *</label>
              <input
                type="text"
                name="cropType"
                value={formData.cropType}
                onChange={handleInputChange}
                placeholder="e.g., Maize, Rice, Cassava"
                required
              />
            </div>

            <div className="form-group">
              <label>Tenure (months) *</label>
              <select
                name="tenure"
                value={formData.tenure}
                onChange={handleInputChange}
                required
              >
                <option value="">-- Select tenure --</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="9">9 months</option>
                <option value="12">12 months</option>
                <option value="18">18 months</option>
                <option value="24">24 months</option>
              </select>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="step-content">
            <h2>Farm Information</h2>
            
            <div className="form-group">
              <label>Farm Size (hectares) *</label>
              <input
                type="number"
                name="farmSize"
                value={formData.farmSize}
                onChange={handleInputChange}
                step="0.1"
                required
              />
            </div>

            <div className="form-group">
              <label>Planting Date *</label>
              <input
                type="date"
                name="plantingDate"
                value={formData.plantingDate}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Expected Harvest Date *</label>
              <input
                type="date"
                name="expectedHarvestDate"
                value={formData.expectedHarvestDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h2>Collateral Information</h2>
            
            <div className="form-group">
              <label>Collateral Type *</label>
              <select
                name="collateralType"
                value={formData.collateralType}
                onChange={handleInputChange}
                required
              >
                <option value="">-- Select collateral --</option>
                <option value="land">Land Title</option>
                <option value="equipment">Farm Equipment</option>
                <option value="warehouse_receipt">Warehouse Receipt</option>
                <option value="guarantee">Guarantee/Surety</option>
              </select>
            </div>

            <div className="form-group">
              <label>Collateral Value (₦) *</label>
              <input
                type="number"
                name="collateralValue"
                value={formData.collateralValue}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Collateral Description</label>
              <textarea
                name="collateralDescription"
                value={formData.collateralDescription}
                onChange={handleInputChange}
                rows={4}
                placeholder="Provide details about the collateral"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="agri-loan-application-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Agricultural Loan Application</h1>
      </div>

      <div className="application-content">
        <div className="stepper">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className={`step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            >
              <div className="step-number">{index + 1}</div>
              <div className="step-label">{step}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="application-form">
          {renderStepContent()}

          <div className="form-actions">
            {currentStep > 0 && (
              <button 
                type="button" 
                className="previous-btn"
                onClick={handlePrevious}
              >
                Previous
              </button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <button 
                type="button" 
                className="next-btn"
                onClick={handleNext}
              >
                Next
              </button>
            ) : (
              <button 
                type="submit" 
                className="submit-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgriLoanApplicationScreen;
