import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';

interface CropCalendar {
  crop_type: string;
  planting_season: string;
  harvest_season: string;
  duration_weeks: number;
  recommended_regions: string[];
}

type ActiveTab = 'calendars' | 'season_loans' | 'vouchers' | 'warehouse';

const FarmerProductsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendars');
  const [calendars, setCalendars] = useState<CropCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Season loan form
  const [seasonLoan, setSeasonLoan] = useState({ farmer_id: '', farm_id: '', crop_type: '', season: '', amount: '' });
  // Voucher form
  const [voucherForm, setVoucherForm] = useState({ farmer_id: '', input_type: 'seeds', amount: '' });
  const [redeemCode, setRedeemCode] = useState('');
  // Warehouse form
  const [warehouseForm, setWarehouseForm] = useState({ farmer_id: '', commodity: '', quantity: '', warehouse_id: '', loan_amount: '' });

  useEffect(() => {
    if (activeTab === 'calendars') fetchCalendars();
  }, [activeTab]);

  const fetchCalendars = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await agricultureService.getCropCalendars();
      setCalendars(data as unknown as CropCalendar[]);
    } catch {
      setError('Failed to load crop calendars');
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonLoan.farmer_id || !seasonLoan.amount) { setError('Farmer ID and amount are required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await agricultureService.createSeasonAlignedLoan({
        farmer_id: seasonLoan.farmer_id,
        farm_id: seasonLoan.farm_id,
        crop_type: seasonLoan.crop_type,
        season: seasonLoan.season,
        loan_amount: Number(seasonLoan.amount),
      });
      setSuccessMsg('Season-aligned loan application submitted!');
      setSeasonLoan({ farmer_id: '', farm_id: '', crop_type: '', season: '', amount: '' });
    } catch {
      setError('Failed to submit loan application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherForm.farmer_id || !voucherForm.amount) { setError('Farmer ID and amount are required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await agricultureService.createInputVoucher({
        farmer_id: voucherForm.farmer_id,
        input_type: voucherForm.input_type,
        amount: Number(voucherForm.amount),
      });
      setSuccessMsg('Input voucher created successfully!');
      setVoucherForm({ farmer_id: '', input_type: 'seeds', amount: '' });
    } catch {
      setError('Failed to create voucher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) { setError('Enter a voucher code'); return; }
    setSubmitting(true);
    setError('');
    try {
      await agricultureService.redeemInputVoucher({ voucher_code: redeemCode });
      setSuccessMsg('Voucher redeemed successfully!');
      setRedeemCode('');
    } catch {
      setError('Failed to redeem voucher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWarehouseLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.farmer_id || !warehouseForm.loan_amount) { setError('Farmer ID and loan amount are required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await agricultureService.createWarehouseReceiptLoan({
        farmer_id: warehouseForm.farmer_id,
        commodity: warehouseForm.commodity,
        quantity: Number(warehouseForm.quantity),
        warehouse_id: warehouseForm.warehouse_id,
        loan_amount: Number(warehouseForm.loan_amount),
      });
      setSuccessMsg('Warehouse receipt loan submitted!');
      setWarehouseForm({ farmer_id: '', commodity: '', quantity: '', warehouse_id: '', loan_amount: '' });
    } catch {
      setError('Failed to submit warehouse receipt loan');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: { key: ActiveTab; label: string; emoji: string }[] = [
    { key: 'calendars', label: 'Crop Calendars', emoji: '📅' },
    { key: 'season_loans', label: 'Season Loans', emoji: '🌱' },
    { key: 'vouchers', label: 'Input Vouchers', emoji: '🎫' },
    { key: 'warehouse', label: 'Warehouse Receipt', emoji: '🏭' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/agriculture')} className="text-gray-500 hover:text-gray-700 mr-2">←</button>
          <h1 className="text-xl font-bold">Farmer Products</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSuccessMsg(''); setError(''); }}
              className={`py-3 px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-green-50'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg text-sm flex items-center gap-2">
            <span>✅</span> {successMsg}
            <button className="ml-auto text-green-600" onClick={() => setSuccessMsg('')}>✕</button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm flex items-center gap-2">
            <span>❌</span> {error}
            <button className="ml-auto text-red-600" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Crop Calendars */}
        {activeTab === 'calendars' && (
          <div className="space-y-3">
            {loading && (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
              </div>
            )}
            {!loading && calendars.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                <p className="text-4xl mb-3">📅</p>
                <p>No crop calendars available</p>
              </div>
            )}
            {calendars.map((cal, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 dark:text-white capitalize">{cal.crop_type}</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {cal.duration_weeks}w duration
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Planting Season</p>
                    <p className="font-medium text-gray-800 dark:text-white">{cal.planting_season || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Harvest Season</p>
                    <p className="font-medium text-gray-800 dark:text-white">{cal.harvest_season || '—'}</p>
                  </div>
                </div>
                {cal.recommended_regions?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {cal.recommended_regions.map((r, j) => (
                      <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Season Loans */}
        {activeTab === 'season_loans' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-1">Apply for Season-Aligned Loan</h3>
            <p className="text-sm text-gray-500 mb-4">Loans structured around your crop's planting and harvest cycle</p>
            <form onSubmit={handleSeasonLoan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Farmer ID *</label>
                  <input
                    type="text" value={seasonLoan.farmer_id}
                    onChange={(e) => setSeasonLoan({ ...seasonLoan, farmer_id: e.target.value })}
                    placeholder="Your farmer ID"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Farm ID</label>
                  <input
                    type="text" value={seasonLoan.farm_id}
                    onChange={(e) => setSeasonLoan({ ...seasonLoan, farm_id: e.target.value })}
                    placeholder="Farm ID"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Crop Type</label>
                  <select
                    value={seasonLoan.crop_type}
                    onChange={(e) => setSeasonLoan({ ...seasonLoan, crop_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select crop</option>
                    {['Maize', 'Rice', 'Wheat', 'Sorghum', 'Cassava', 'Yam', 'Groundnut', 'Soybean'].map((c) => (
                      <option key={c} value={c.toLowerCase()}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Season</label>
                  <select
                    value={seasonLoan.season}
                    onChange={(e) => setSeasonLoan({ ...seasonLoan, season: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select season</option>
                    <option value="wet_season_1">Wet Season 1 (Mar–Jul)</option>
                    <option value="wet_season_2">Wet Season 2 (Aug–Nov)</option>
                    <option value="dry_season">Dry Season (Nov–Feb)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Loan Amount (₦) *</label>
                <input
                  type="number" value={seasonLoan.amount}
                  onChange={(e) => setSeasonLoan({ ...seasonLoan, amount: e.target.value })}
                  placeholder="e.g. 500000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Apply for Season Loan'}
              </button>
            </form>
          </div>
        )}

        {/* Input Vouchers */}
        {activeTab === 'vouchers' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1">Request Input Voucher</h3>
              <p className="text-sm text-gray-500 mb-4">Get vouchers for seeds, fertilizers, and other farm inputs</p>
              <form onSubmit={handleCreateVoucher} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Farmer ID *</label>
                    <input
                      type="text" value={voucherForm.farmer_id}
                      onChange={(e) => setVoucherForm({ ...voucherForm, farmer_id: e.target.value })}
                      placeholder="Your farmer ID"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Input Type</label>
                    <select
                      value={voucherForm.input_type}
                      onChange={(e) => setVoucherForm({ ...voucherForm, input_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="seeds">Seeds</option>
                      <option value="fertilizer">Fertilizer</option>
                      <option value="pesticide">Pesticide</option>
                      <option value="herbicide">Herbicide</option>
                      <option value="equipment">Equipment</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Voucher Amount (₦) *</label>
                  <input
                    type="number" value={voucherForm.amount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, amount: e.target.value })}
                    placeholder="e.g. 50000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <button
                  type="submit" disabled={submitting}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Request Voucher'}
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1">Redeem Voucher</h3>
              <p className="text-sm text-gray-500 mb-4">Enter your voucher code to redeem inputs at an authorised supplier</p>
              <form onSubmit={handleRedeemVoucher} className="flex gap-2">
                <input
                  type="text" value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="Enter voucher code"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  type="submit" disabled={submitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? '...' : 'Redeem'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Warehouse Receipt Loan */}
        {activeTab === 'warehouse' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-1">Warehouse Receipt Loan</h3>
            <p className="text-sm text-gray-500 mb-4">Use stored commodities as collateral to access finance</p>
            <form onSubmit={handleWarehouseLoan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Farmer ID *</label>
                  <input
                    type="text" value={warehouseForm.farmer_id}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, farmer_id: e.target.value })}
                    placeholder="Your farmer ID"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Commodity</label>
                  <select
                    value={warehouseForm.commodity}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, commodity: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select commodity</option>
                    {['Maize', 'Rice', 'Sorghum', 'Groundnut', 'Soybean', 'Cocoa', 'Cotton'].map((c) => (
                      <option key={c} value={c.toLowerCase()}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Quantity (MT)</label>
                  <input
                    type="number" value={warehouseForm.quantity}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, quantity: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Warehouse ID</label>
                  <input
                    type="text" value={warehouseForm.warehouse_id}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, warehouse_id: e.target.value })}
                    placeholder="e.g. WH-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Loan Amount (₦) *</label>
                <input
                  type="number" value={warehouseForm.loan_amount}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, loan_amount: e.target.value })}
                  placeholder="e.g. 2000000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <button
                type="submit" disabled={submitting}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Apply for Warehouse Receipt Loan'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmerProductsScreen;
