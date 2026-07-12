import React, { useState } from 'react';
import { FiArrowLeft, FiBook, FiUser, FiDollarSign } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { EducationLoanApplicationRequest } from '../../../models/education_loan';
import { educationLoanService } from '../../../services/education_loan_service';

const EducationLoanApplicationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentBvn, setStudentBvn] = useState('');
  const [studentNin, setStudentNin] = useState('');
  const [loanType, setLoanType] = useState('school');
  const [institutionId, setInstitutionId] = useState('');
  const [programName, setProgramName] = useState('');
  const [programDuration, setProgramDuration] = useState(4);
  const [currentYear, setCurrentYear] = useState(1);
  const [tuitionFeePerYear, setTuitionFeePerYear] = useState(0);
  const [accommodationPerYear, setAccommodationPerYear] = useState(0);
  const [booksAndMaterials, setBooksAndMaterials] = useState(0);
  const [livingExpenses, setLivingExpenses] = useState(0);
  const [requestedAmount, setRequestedAmount] = useState(0);
  const [repaymentType, setRepaymentType] = useState('monthly');
  const [repaymentTenorMonths, setRepaymentTenorMonths] = useState(48);

  const totalPerYear = tuitionFeePerYear + accommodationPerYear + booksAndMaterials + livingExpenses;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId.trim() || !studentName.trim() || !studentEmail.trim() || !studentPhone.trim()) {
      alert('Please fill in all required student fields');
      return;
    }
    if (!institutionId.trim() || !programName.trim()) {
      alert('Please fill in institution ID and program name');
      return;
    }
    if (tuitionFeePerYear <= 0 || requestedAmount <= 0) {
      alert('Please enter valid tuition fee and requested amount');
      return;
    }

    try {
      setLoading(true);
      const payload: EducationLoanApplicationRequest = {
        student_id: studentId.trim(),
        student_name: studentName.trim(),
        student_email: studentEmail.trim(),
        student_phone: studentPhone.trim(),
        ...(studentBvn.trim() && { student_bvn: studentBvn.trim() }),
        ...(studentNin.trim() && { student_nin: studentNin.trim() }),
        loan_type: loanType,
        institution_id: institutionId.trim(),
        program_name: programName.trim(),
        program_duration_years: programDuration,
        current_year: currentYear,
        tuition_fee_per_year: tuitionFeePerYear,
        ...(accommodationPerYear > 0 && { accommodation_per_year: accommodationPerYear }),
        ...(booksAndMaterials > 0 && { books_and_materials: booksAndMaterials }),
        ...(livingExpenses > 0 && { living_expenses: livingExpenses }),
        requested_amount: requestedAmount,
        repayment_type: repaymentType,
        repayment_tenor_months: repaymentTenorMonths,
      };

      const result = await educationLoanService.applyForEducationLoan(payload);

      if (result.success) {
        alert(result.message);
        navigate('/education-loans');
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

  const inputCls = 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-700 dark:to-blue-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3 mb-4">
            <button
              onClick={() => navigate('/education-loans')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Education Loan Application</h1>
          </div>
          <p className="text-white/90 text-sm">Complete the form to apply for an education loan</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Student Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FiUser className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Student Information</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Student ID *</label>
                  <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Your account or student ID" className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g., Chukwuemeka Obi" className={inputCls} required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email Address *</label>
                  <input type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@example.com" className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <input type="tel" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="080XXXXXXXX" className={inputCls} required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>BVN (optional)</label>
                  <input type="text" value={studentBvn} onChange={(e) => setStudentBvn(e.target.value)}
                    placeholder="Bank Verification Number" className={inputCls} maxLength={11} />
                </div>
                <div>
                  <label className={labelCls}>NIN (optional)</label>
                  <input type="text" value={studentNin} onChange={(e) => setStudentNin(e.target.value)}
                    placeholder="National ID Number" className={inputCls} maxLength={11} />
                </div>
              </div>
            </div>
          </div>

          {/* Academic Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FiBook className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Academic Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Loan Type *</label>
                <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className={inputCls}>
                  <option value="school">School Fees Loan</option>
                  <option value="personal">Personal Study Loan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Institution ID *</label>
                <input type="text" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}
                  placeholder="Institution registration ID" className={inputCls} required />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Contact your institution for their 54Link registered ID</p>
              </div>
              <div>
                <label className={labelCls}>Program Name *</label>
                <input type="text" value={programName} onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g., Computer Science" className={inputCls} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Program Duration (years) *</label>
                  <select value={programDuration} onChange={(e) => setProgramDuration(Number(e.target.value))} className={inputCls}>
                    {[1, 2, 3, 4, 5, 6, 7].map((y) => (
                      <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Current Year (optional)</label>
                  <select value={currentYear} onChange={(e) => setCurrentYear(Number(e.target.value))} className={inputCls}>
                    {[1, 2, 3, 4, 5, 6, 7].map((y) => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FiDollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Financial Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tuition Fee Per Year (₦) *</label>
                <input type="number" value={tuitionFeePerYear || ''} min="0"
                  onChange={(e) => setTuitionFeePerYear(Number(e.target.value))}
                  placeholder="0" className={inputCls} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Accommodation/Year (₦)</label>
                  <input type="number" value={accommodationPerYear || ''} min="0"
                    onChange={(e) => setAccommodationPerYear(Number(e.target.value))}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Books & Materials (₦)</label>
                  <input type="number" value={booksAndMaterials || ''} min="0"
                    onChange={(e) => setBooksAndMaterials(Number(e.target.value))}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Living Expenses (₦)</label>
                  <input type="number" value={livingExpenses || ''} min="0"
                    onChange={(e) => setLivingExpenses(Number(e.target.value))}
                    placeholder="0" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Requested Loan Amount (₦) *</label>
                <input type="number" value={requestedAmount || ''} min="0"
                  onChange={(e) => setRequestedAmount(Number(e.target.value))}
                  placeholder="Total amount you need" className={inputCls} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Repayment Type</label>
                  <select value={repaymentType} onChange={(e) => setRepaymentType(e.target.value)} className={inputCls}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Repayment Tenor (months)</label>
                  <select value={repaymentTenorMonths} onChange={(e) => setRepaymentTenorMonths(Number(e.target.value))} className={inputCls}>
                    {[12, 24, 36, 48, 60, 72, 84, 96].map((m) => (
                      <option key={m} value={m}>{m} months ({m / 12} {m / 12 === 1 ? 'year' : 'years'})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          {totalPerYear > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Annual Cost</p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(totalPerYear)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Requested Amount</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(requestedAmount)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate('/education-loans')}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EducationLoanApplicationScreen;
