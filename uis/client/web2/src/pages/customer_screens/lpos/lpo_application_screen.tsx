import React, { useEffect, useRef, useState } from "react";
import { FiFile, FiUpload, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import SuccessScreen from "../../../components/SuccessScreen";
import { useAuth } from "../../../contexts/AuthContext";
import { lpoService } from "../../../services/lpo_service";
import { businessService } from "../../../services/business_service";
import type { Business } from "../../../services/business_service";
import { TenantService } from "../../../services/tenant_service";

export default function LPOApplicationScreen() {
  const navigate = useNavigate();
  const { isLoading } = useAuth();
  const [formData, setFormData] = useState({
    supplierId: "",
    issuingOrganization: "",
    lpoAmount: "",
    financingAmount: "",
    repaymentDays: "30",
    documentUrl: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessSearch, setBusinessSearch] = useState('');
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    businessService.getBusinesses().then((list) => {
      setBusinesses(list);
      setLoadingBusinesses(false);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBusinessDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const selectBusiness = (b: Business) => {
    setSelectedBusiness(b);
    setFormData(prev => ({ ...prev, supplierId: b.id, issuingOrganization: b.name }));
    setBusinessSearch('');
    setShowBusinessDropdown(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      
      // Create preview for images and PDFs
      const fileType = file.type;
      if (fileType.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setDocumentPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else if (fileType === 'application/pdf') {
        setDocumentPreview('pdf');
      }
      
      // Upload to server
      try {
        const uploadFormData = new FormData();
        uploadFormData.append('document', file);
        // const uploadResponse = await apiService.post(
        //   `${AppConfig.lpoEndpoint}/upload-document`,
        //   uploadFormData,
        //   { headers: { 'Content-Type': 'multipart/form-data' } }
        // );
        // if (uploadResponse.data.success) {
        //   setFormData(prev => ({ ...prev, documentUrl: uploadResponse.data.data.url }));
        // }
        setFormData(prev => ({ ...prev, documentUrl: 'https://www.google.com' }));
      } catch (error) {
        console.error('Failed to upload document:', error);
        alert('Failed to upload document');
      }
    }
  };

  const removeDocument = () => {
    setUploadedFile(null);
    setDocumentPreview(null);
    setFormData(prev => ({ ...prev, documentUrl: "" }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.supplierId) newErrors.supplierId = "Please select a supplier";
    if (!formData.issuingOrganization) newErrors.issuingOrganization = "Required";
    if (!formData.lpoAmount) newErrors.lpoAmount = "Required";
    else if (isNaN(Number(formData.lpoAmount)) || Number(formData.lpoAmount) <= 0)
      newErrors.lpoAmount = "Invalid amount";
    if (!formData.financingAmount) newErrors.financingAmount = "Required";
    else if (isNaN(Number(formData.financingAmount)) || Number(formData.financingAmount) <= 0)
      newErrors.financingAmount = "Invalid amount";
    else if (Number(formData.financingAmount) > Number(formData.lpoAmount))
      newErrors.financingAmount = "Cannot exceed LPO amount";
    if (!formData.repaymentDays) newErrors.repaymentDays = "Required";
    else if (isNaN(Number(formData.repaymentDays)) || Number(formData.repaymentDays) <= 0)
      newErrors.repaymentDays = "Invalid number";
    if (!uploadedFile) newErrors.documentUrl = "Please upload LPO document";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Wait for authentication to finish loading
      if (isLoading) {
        throw new Error('Authentication is still loading. Please wait...');
      }

      // // Check if user is authenticated
      // if (!isAuthenticated || !user) {
      //   throw new Error('User not authenticated. Please log in and try again.');
      // }

      // Get keycloak_id from localStorage (synchronous operation)
      const lpoNumber = localStorage.getItem('keycloak_id');
      if (!lpoNumber) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Get tenant ID from TenantService or fallback to user.id
      let tenantId = TenantService.getTenantId();
      // If not found, try to get from config and save it
      if (!tenantId) {
        const tenantConfig = TenantService.loadTenantConfig();
        if (tenantConfig && tenantConfig.id) {
          tenantId = tenantConfig.id;
          TenantService.saveTenantId(tenantId);
        }
      }
      if (!tenantId) {
        throw new Error('Tenant ID not found. Please ensure you are properly logged in.');
      }

      await lpoService.applyForLPO({
        supplierId: formData.supplierId,
        tenantId: tenantId,
        lpoNumber: lpoNumber,
        issuingOrganization: formData.issuingOrganization,
        lpoAmount: Number(formData.lpoAmount),
        financingAmount: Number(formData.financingAmount),
        repaymentDays: Number(formData.repaymentDays),
        lpoDocumentUrl: formData.documentUrl,
      });

      setShowSuccess(true);
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../../utils/error_utils');
      alert("Error submitting LPO application: " + getErrorMessage(err, 'Failed to submit LPO application'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigate('/lpo');
  };

  const buildSection = (title: string, children: React.ReactNode) => (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
      <h2 className="flex items-center text-lg font-bold mb-4 text-gray-900 dark:text-white">
        {title}
      </h2>
      {children}
    </div>
  );

  const buildInput = (
    name: string,
    label: string,
    type: React.HTMLInputTypeAttribute = "text"
  ) => (
    <div className="mb-4">
      <label className="block font-medium mb-1 text-gray-900 dark:text-white">{label}</label>
      <input
        name={name}
        type={type}
        value={(formData as any)[name]}
        onChange={handleChange}
        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 dark:text-white ${
          errors[name] ? "border-red-500 ring-red-200" : "border-gray-300 dark:border-gray-600 ring-[var(--primary-color)]"
        }`}
      />
      {errors[name] && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors[name]}</p>}
    </div>
  );

  const buildBusinessDropdown = () => (
    <div className="mb-4 relative" ref={dropdownRef}>
      <label className="block font-medium mb-1 text-gray-900 dark:text-white">Select Business *</label>
      {selectedBusiness ? (
        <div className="flex items-center justify-between px-4 py-2 border border-[var(--primary-color)] rounded-lg bg-white dark:bg-gray-700">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{selectedBusiness.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Reg: {selectedBusiness.registration_number} · {selectedBusiness.verification_status}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedBusiness(null);
              setFormData(prev => ({ ...prev, supplierId: '', issuingOrganization: '' }));
            }}
            className="text-gray-400 hover:text-red-500 ml-2"
          >
            <FiX size={16} />
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={businessSearch}
          onChange={(e) => { setBusinessSearch(e.target.value); setShowBusinessDropdown(true); }}
          onFocus={() => setShowBusinessDropdown(true)}
          placeholder={loadingBusinesses ? 'Loading businesses...' : 'Search registered businesses...'}
          disabled={loadingBusinesses}
          autoComplete="off"
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 dark:text-white ${
            errors.supplierId ? "border-red-500 ring-red-200" : "border-gray-300 dark:border-gray-600 ring-[var(--primary-color)]"
          }`}
        />
      )}
      {showBusinessDropdown && !selectedBusiness && (
        <div className="absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
          {businesses
            .filter(b =>
              b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
              b.registration_number.toLowerCase().includes(businessSearch.toLowerCase())
            )
            .map(b => (
              <button
                key={b.id}
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => selectBusiness(b)}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">{b.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reg: {b.registration_number}</p>
              </button>
            ))}
          {businesses.filter(b =>
            b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
            b.registration_number.toLowerCase().includes(businessSearch.toLowerCase())
          ).length === 0 && (
            <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No businesses found</p>
          )}
        </div>
      )}
      {errors.supplierId && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.supplierId}</p>}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="bg-linear-to-r from-[var(--primary-color)] to-[var(--secondary-color)]  p-6 rounded-xl text-white mb-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-2">LPO Application</h1>
        <p>Fill in the details below</p>
      </div>

      {buildSection("Business Information", <>
        {buildBusinessDropdown()}
        {buildInput("issuingOrganization", "Issuing Organization")}
      </>)}

      {buildSection("LPO Details", <>
        {buildInput("lpoAmount", "LPO Amount (₦)", "number")}
        {buildInput("financingAmount", "Financing Amount (₦)", "number")}
        {buildInput("repaymentDays", "Repayment Period (Days)", "number")}
      </>)}

      {buildSection("LPO Document", <>
        <div className="mb-4">
          <label className="block font-medium mb-2 text-gray-900 dark:text-white">Upload LPO Document *</label>
          
          {!uploadedFile ? (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-[var(--primary-color)] dark:hover:border-[var(--primary-color)] transition-colors bg-gray-50 dark:bg-gray-700">
              <input
                type="file"
                id="lpo-document"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="lpo-document"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="bg-[var(--primary-color)] dark:bg-[var(--primary-color)]/30 p-4 rounded-full">
                  <FiUpload size={32} className="text-[var(--primary-color)] dark:text-[var(--primary-color)]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">Click to upload</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">PDF, JPG, PNG (Max 10MB)</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {documentPreview && documentPreview !== 'pdf' ? (
                    <img
                      src={documentPreview}
                      alt="Document preview"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                      <FiFile size={32} className="text-red-600 dark:text-red-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {documentPreview && documentPreview !== 'pdf' && (
                      <button
                        onClick={() => window.open(documentPreview, '_blank')}
                        className="text-sm text-[var(--primary-color)] dark:text-[var(--primary-color)] hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)] mt-1"
                      >
                        View full preview
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={removeDocument}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>
          )}
          {errors.documentUrl && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.documentUrl}</p>}
        </div>
      </>)}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={`w-full py-3 rounded-xl text-white font-bold ${
          isSubmitting ? "bg-gray-400 dark:bg-gray-600" : "bg-[var(--primary-color)] dark:bg-[var(--primary-color)] hover:bg-[var(--primary-color)] dark:hover:bg-[var(--primary-color)]"
        }`}
      >
        {isSubmitting ? "Submitting..." : "Submit Application"}
      </button>

      {showSuccess && (
        <SuccessScreen
          title="LPO Application Submitted!"
          message="Your LPO financing application has been submitted successfully. We'll review it and get back to you shortly."
          onContinue={handleSuccessClose}
          buttonText="Done"
        />
      )}
    </div>
  );
}
