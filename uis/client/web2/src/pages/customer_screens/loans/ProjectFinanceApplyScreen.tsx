import React, { useEffect, useRef, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { Business } from '../../../services/business_service';
import { businessService } from '../../../services/business_service';
import { apiService } from '../../../services/api_service';
import { AppConfig } from '../../../config/app_config';

export default function ProjectFinanceApplyScreen() {
  const navigate = useNavigate();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessSearch, setBusinessSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [financeAmount, setFinanceAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('12');
  const [sector, setSector] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sectors = [
    'Infrastructure', 'Energy', 'Real Estate', 'Manufacturing',
    'Agriculture', 'Technology', 'Healthcare', 'Education', 'Other',
  ];

  useEffect(() => {
    businessService.getBusinesses().then((list) => {
      setBusinesses(list);
      setLoadingBusinesses(false);
    });
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filteredBusinesses = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
      b.registration_number.toLowerCase().includes(businessSearch.toLowerCase())
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedBusiness) errs.business = 'Please select a business';
    if (!projectName.trim()) errs.projectName = 'Required';
    if (!financeAmount || isNaN(Number(financeAmount)) || Number(financeAmount) <= 0)
      errs.financeAmount = 'Enter a valid amount';
    if (!durationMonths || isNaN(Number(durationMonths)) || Number(durationMonths) <= 0)
      errs.duration = 'Enter a valid duration';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await apiService.post(
        `${AppConfig.loanEndpoint}/project-finance`,
        {
          business_id: selectedBusiness!.id,
          business_name: selectedBusiness!.name,
          project_name: projectName.trim(),
          project_description: projectDescription.trim(),
          finance_amount: Number(financeAmount),
          duration_months: Number(durationMonths),
          sector: sector || undefined,
        }
      );
      alert('Project finance application submitted successfully!');
      navigate(-1);
    } catch {
      alert('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
      errors[field]
        ? 'border-red-500 ring-red-200'
        : 'border-gray-300 dark:border-gray-600 ring-[var(--primary-color)]'
    }`;
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-[var(--primary-color)] to-[var(--secondary-color)] px-4 py-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full">
            <FiArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Project Finance Application</h1>
            <p className="text-white/80 text-sm">Apply for project financing for a registered business</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business selector */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Business</h2>
            <div className="relative" ref={dropdownRef}>
              <label className={labelCls}>Select Registered Business *</label>
              {selectedBusiness ? (
                <div className="flex items-center justify-between px-4 py-3 border border-[var(--primary-color)] rounded-lg bg-white dark:bg-gray-700">
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{selectedBusiness.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reg: {selectedBusiness.registration_number} · {selectedBusiness.verification_status}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedBusiness(null)} className="text-gray-400 hover:text-red-500 ml-2 text-lg">×</button>
                </div>
              ) : (
                <input
                  type="text"
                  value={businessSearch}
                  onChange={(e) => { setBusinessSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder={loadingBusinesses ? 'Loading...' : 'Search by name or registration number'}
                  disabled={loadingBusinesses}
                  autoComplete="off"
                  className={inputCls('business')}
                />
              )}
              {showDropdown && !selectedBusiness && (
                <div className="absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                  {filteredBusinesses.map((b) => (
                    <button key={b.id} type="button"
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => { setSelectedBusiness(b); setBusinessSearch(''); setShowDropdown(false); }}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{b.name}</p>
                      <p className="text-xs text-gray-500">Reg: {b.registration_number}</p>
                    </button>
                  ))}
                  {filteredBusinesses.length === 0 && (
                    <p className="px-4 py-2 text-sm text-gray-500">No businesses found</p>
                  )}
                </div>
              )}
              {errors.business && <p className="text-red-500 text-sm mt-1">{errors.business}</p>}
            </div>
          </div>

          {/* Project details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Project Details</h2>
            <div>
              <label className={labelCls}>Project Name *</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Solar Farm Phase 1, Highway Extension" className={inputCls('projectName')} />
              {errors.projectName && <p className="text-red-500 text-sm mt-1">{errors.projectName}</p>}
            </div>
            <div>
              <label className={labelCls}>Sector</label>
              <select value={sector} onChange={(e) => setSector(e.target.value)} className={inputCls('')}>
                <option value="">Select sector (optional)</option>
                {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Project Description (optional)</label>
              <textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)}
                rows={3} placeholder="Describe the project scope and objectives"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ring-[var(--primary-color)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Finance Amount (₦) *</label>
                <input type="number" value={financeAmount} min="0" step="0.01"
                  onChange={(e) => setFinanceAmount(e.target.value)}
                  placeholder="0.00" className={inputCls('financeAmount')} />
                {errors.financeAmount && <p className="text-red-500 text-sm mt-1">{errors.financeAmount}</p>}
              </div>
              <div>
                <label className={labelCls}>Duration (months) *</label>
                <input type="number" value={durationMonths} min="1"
                  onChange={(e) => setDurationMonths(e.target.value)}
                  className={inputCls('duration')} />
                {errors.duration && <p className="text-red-500 text-sm mt-1">{errors.duration}</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)}
              className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-3 bg-[var(--primary-color)] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
