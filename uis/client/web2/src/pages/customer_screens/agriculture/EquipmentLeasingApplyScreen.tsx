import React, { useEffect, useRef, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { Business } from '../../../services/business_service';
import { businessService } from '../../../services/business_service';
import { apiService } from '../../../services/api_service';
import { AppConfig } from '../../../config/app_config';

export default function EquipmentLeasingApplyScreen() {
  const navigate = useNavigate();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessSearch, setBusinessSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [equipmentType, setEquipmentType] = useState('');
  const [description, setDescription] = useState('');
  const [leaseAmount, setLeaseAmount] = useState('');
  const [leaseDurationMonths, setLeaseDurationMonths] = useState('12');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!equipmentType.trim()) errs.equipmentType = 'Required';
    if (!leaseAmount || isNaN(Number(leaseAmount)) || Number(leaseAmount) <= 0)
      errs.leaseAmount = 'Enter a valid amount';
    if (!leaseDurationMonths || isNaN(Number(leaseDurationMonths)) || Number(leaseDurationMonths) <= 0)
      errs.leaseDuration = 'Enter a valid duration';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await apiService.post(
        `${AppConfig.agricultureEndpoint}/equipment-leasing`,
        {
          business_id: selectedBusiness!.id,
          business_name: selectedBusiness!.name,
          equipment_type: equipmentType.trim(),
          description: description.trim(),
          lease_amount: Number(leaseAmount),
          lease_duration_months: Number(leaseDurationMonths),
        }
      );
      alert('Equipment leasing application submitted successfully!');
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
            <h1 className="text-xl font-bold text-white">Equipment Leasing Application</h1>
            <p className="text-white/80 text-sm">Apply for equipment leasing for a registered business</p>
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reg: {selectedBusiness.registration_number}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedBusiness(null)} className="text-gray-400 hover:text-red-500 text-lg ml-2">×</button>
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

          {/* Equipment details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Equipment Details</h2>
            <div>
              <label className={labelCls}>Equipment Type *</label>
              <input type="text" value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)}
                placeholder="e.g., Tractor, Generator, Industrial Mixer" className={inputCls('equipmentType')} />
              {errors.equipmentType && <p className="text-red-500 text-sm mt-1">{errors.equipmentType}</p>}
            </div>
            <div>
              <label className={labelCls}>Description (optional)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3} placeholder="Provide additional details about the equipment"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ring-[var(--primary-color)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Lease Amount (₦) *</label>
                <input type="number" value={leaseAmount} min="0" step="0.01"
                  onChange={(e) => setLeaseAmount(e.target.value)}
                  placeholder="0.00" className={inputCls('leaseAmount')} />
                {errors.leaseAmount && <p className="text-red-500 text-sm mt-1">{errors.leaseAmount}</p>}
              </div>
              <div>
                <label className={labelCls}>Lease Duration (months) *</label>
                <input type="number" value={leaseDurationMonths} min="1"
                  onChange={(e) => setLeaseDurationMonths(e.target.value)}
                  className={inputCls('leaseDuration')} />
                {errors.leaseDuration && <p className="text-red-500 text-sm mt-1">{errors.leaseDuration}</p>}
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
