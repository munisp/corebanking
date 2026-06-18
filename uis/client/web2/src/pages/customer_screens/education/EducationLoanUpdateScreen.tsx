import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { apiService } from '../../../services/api_service';
import type { EducationLoan } from '../../../models/education_loan';

const LOAN_TYPES = ['undergraduate', 'postgraduate', 'vocational', 'professional'];
const GENDERS = ['male', 'female', 'other'];
const INSTITUTION_TYPES = ['university', 'polytechnic', 'college_of_education', 'monotechnic', 'vocational_school'];
const REPAYMENT_TYPES = ['annuity', 'bullet', 'equal_principal'];

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] text-sm';
const selectCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] text-sm appearance-none';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-3 shadow-sm border border-gray-100 dark:border-gray-700">
    <h3 className="text-base font-semibold text-gray-900 dark:text-white pb-1 border-b border-gray-100 dark:border-gray-700">{title}</h3>
    {children}
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; half?: boolean }> = ({ label, children, half }) => (
  <div className={`space-y-1.5${half ? ' flex-1 min-w-0' : ''}`}>
    <label className="text-[13px] font-medium text-gray-600 dark:text-gray-400">{label}</label>
    {children}
  </div>
);

interface RawApp extends EducationLoan {
  studentId?: string;
  studentName?: string;
  studentBvn?: string;
  studentNin?: string;
  studentEmail?: string;
  studentPhone?: string;
  gender?: string;
  stateOfOrigin?: string;
  loanType?: string;
  institutionData?: {
    id?: string;
    name?: string;
    type?: string;
    nucAccredited?: boolean;
    accreditationNumber?: string;
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    bankAccountNumber?: string;
    bankName?: string;
    bankCode?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  programName?: string;
  programDurationYears?: number;
  currentYear?: number;
  admissionNumber?: string;
  admissionLetterId?: string;
  tuitionFeePerYear?: number;
  accommodationPerYear?: number;
  booksAndMaterials?: number;
  livingExpenses?: number;
  requestedAmount?: number;
  repaymentType?: string;
  moratoriumMonths?: number;
  repaymentTenorMonths?: number;
}

const EducationLoanUpdateScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const app = location.state?.application as RawApp | undefined;

  const inst = app?.institutionData ?? {};

  const [studentId, setStudentId] = useState(app?.studentId ?? '');
  const [studentName, setStudentName] = useState(app?.studentName ?? '');
  const [studentBvn, setStudentBvn] = useState(app?.studentBvn ?? '');
  const [studentNin, setStudentNin] = useState(app?.studentNin ?? '');
  const [studentEmail, setStudentEmail] = useState(app?.studentEmail ?? '');
  const [studentPhone, setStudentPhone] = useState(app?.studentPhone ?? '');
  const [gender, setGender] = useState(app?.gender ?? '');
  const [stateOfOrigin, setStateOfOrigin] = useState(app?.stateOfOrigin ?? '');
  const [loanType, setLoanType] = useState(app?.loanType ?? app?.studyLevel ?? '');

  const [institutionId, setInstitutionId] = useState(inst?.id ?? '');
  const [institutionName, setInstitutionName] = useState(inst?.name ?? app?.institution ?? '');
  const [institutionType, setInstitutionType] = useState(inst?.type ?? '');
  const [nucAccredited, setNucAccredited] = useState(inst?.nucAccredited ?? false);
  const [accreditationNumber, setAccreditationNumber] = useState(inst?.accreditationNumber ?? '');
  const [institutionCountry, setInstitutionCountry] = useState(inst?.country ?? '');
  const [institutionState, setInstitutionState] = useState(inst?.state ?? '');
  const [institutionCity, setInstitutionCity] = useState(inst?.city ?? '');
  const [institutionAddress, setInstitutionAddress] = useState(inst?.address ?? '');
  const [bankAccount, setBankAccount] = useState(inst?.bankAccountNumber ?? '');
  const [bankName, setBankName] = useState(inst?.bankName ?? '');
  const [bankCode, setBankCode] = useState(inst?.bankCode ?? '');
  const [contactPerson, setContactPerson] = useState(inst?.contactPerson ?? '');
  const [contactEmail, setContactEmail] = useState(inst?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(inst?.contactPhone ?? '');

  const [programName, setProgramName] = useState(app?.programName ?? app?.courseOfStudy ?? '');
  const [programDuration, setProgramDuration] = useState(
    String(app?.programDurationYears ?? app?.loanTerm ?? '')
  );
  const [currentYear, setCurrentYear] = useState(String(app?.currentYear ?? ''));
  const [admissionNumber, setAdmissionNumber] = useState(app?.admissionNumber ?? '');
  const [admissionLetterId, setAdmissionLetterId] = useState(app?.admissionLetterId ?? '');

  const [tuitionFee, setTuitionFee] = useState(String(app?.tuitionFeePerYear ?? app?.tuitionFees ?? ''));
  const [accommodation, setAccommodation] = useState(String(app?.accommodationPerYear ?? ''));
  const [booksAndMaterials, setBooksAndMaterials] = useState(String(app?.booksAndMaterials ?? app?.booksMaterials ?? ''));
  const [livingExpenses, setLivingExpenses] = useState(String(app?.livingExpenses ?? ''));
  const [requestedAmount, setRequestedAmount] = useState(
    String(app?.requestedAmount ?? app?.totalAmount ?? '')
  );
  const [repaymentType, setRepaymentType] = useState(app?.repaymentType ?? '');
  const [moratoriumMonths, setMoratoriumMonths] = useState(String(app?.moratoriumMonths ?? ''));
  const [repaymentTenor, setRepaymentTenor] = useState(String(app?.repaymentTenorMonths ?? ''));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app?.id) return;
    setLoading(true);
    setError(null);
    try {
      await apiService.put(`/education-loan/applications/${app.id}`, {
        student_id: studentId,
        student_name: studentName,
        student_bvn: studentBvn,
        student_nin: studentNin,
        student_email: studentEmail,
        student_phone: studentPhone,
        gender,
        state_of_origin: stateOfOrigin,
        loan_type: loanType,
        institution: {
          id: institutionId,
          name: institutionName,
          type: institutionType,
          nuc_accredited: nucAccredited,
          accreditation_number: accreditationNumber,
          country: institutionCountry,
          state: institutionState,
          city: institutionCity,
          address: institutionAddress,
          bank_account_number: bankAccount,
          bank_name: bankName,
          bank_code: bankCode,
          contact_person: contactPerson,
          contact_email: contactEmail,
          contact_phone: contactPhone,
        },
        program_name: programName,
        program_duration_years: parseInt(programDuration) || 0,
        current_year: parseInt(currentYear) || 0,
        admission_number: admissionNumber,
        admission_letter_id: admissionLetterId,
        tuition_fee_per_year: parseFloat(tuitionFee) || 0,
        accommodation_per_year: parseFloat(accommodation) || 0,
        books_and_materials: parseFloat(booksAndMaterials) || 0,
        living_expenses: parseFloat(livingExpenses) || 0,
        requested_amount: parseFloat(requestedAmount) || 0,
        repayment_type: repaymentType,
        moratorium_months: parseInt(moratoriumMonths) || 0,
        repayment_tenor_months: parseInt(repaymentTenor) || 0,
      });
      navigate(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update application');
    } finally {
      setLoading(false);
    }
  };

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">No application data found.</p>
        <button
          onClick={() => navigate('/education-loans')}
          className="px-6 py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: 'var(--primary-color)' }}
        >
          Back to Education Loans
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Update Application</h1>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="p-4 space-y-4 max-w-2xl mx-auto pb-10">
        {/* Student Information */}
        <Section title="Student Information">
          <div className="flex gap-3">
            <Field label="Student ID" half>
              <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)} className={inputCls} placeholder="STU-001" />
            </Field>
            <Field label="Full Name" half>
              <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className={inputCls} placeholder="Full name" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="BVN" half>
              <input type="text" value={studentBvn} onChange={e => setStudentBvn(e.target.value)} className={inputCls} placeholder="11 digits" maxLength={11} />
            </Field>
            <Field label="NIN" half>
              <input type="text" value={studentNin} onChange={e => setStudentNin(e.target.value)} className={inputCls} placeholder="11 digits" maxLength={11} />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Email" half>
              <input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} className={inputCls} placeholder="email@example.com" />
            </Field>
            <Field label="Phone" half>
              <input type="tel" value={studentPhone} onChange={e => setStudentPhone(e.target.value)} className={inputCls} placeholder="+234..." />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Gender" half>
              <select value={gender} onChange={e => setGender(e.target.value)} className={selectCls}>
                <option value="">Select gender</option>
                {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="State of Origin" half>
              <input type="text" value={stateOfOrigin} onChange={e => setStateOfOrigin(e.target.value)} className={inputCls} placeholder="e.g. Lagos" />
            </Field>
          </div>
        </Section>

        {/* Loan Details */}
        <Section title="Loan Details">
          <Field label="Loan Type">
            <select value={loanType} onChange={e => setLoanType(e.target.value)} className={selectCls}>
              <option value="">Select loan type</option>
              {LOAN_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </Field>
        </Section>

        {/* Institution Information */}
        <Section title="Institution Information">
          <div className="flex gap-3">
            <Field label="Institution ID" half>
              <input type="text" value={institutionId} onChange={e => setInstitutionId(e.target.value)} className={inputCls} placeholder="INST-001" />
            </Field>
            <Field label="Institution Name" half>
              <input type="text" value={institutionName} onChange={e => setInstitutionName(e.target.value)} className={inputCls} placeholder="University name" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Type" half>
              <select value={institutionType} onChange={e => setInstitutionType(e.target.value)} className={selectCls}>
                <option value="">Select type</option>
                {INSTITUTION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </Field>
            <Field label="NUC Accredited" half>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={nucAccredited} onChange={e => setNucAccredited(e.target.checked)} className="w-4 h-4 rounded accent-[var(--primary-color)]" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Accredited</span>
                </label>
              </div>
            </Field>
          </div>
          {nucAccredited && (
            <Field label="Accreditation Number">
              <input type="text" value={accreditationNumber} onChange={e => setAccreditationNumber(e.target.value)} className={inputCls} placeholder="NUC/..." />
            </Field>
          )}
          <div className="flex gap-3">
            <Field label="Country" half>
              <input type="text" value={institutionCountry} onChange={e => setInstitutionCountry(e.target.value)} className={inputCls} placeholder="Nigeria" />
            </Field>
            <Field label="State" half>
              <input type="text" value={institutionState} onChange={e => setInstitutionState(e.target.value)} className={inputCls} placeholder="State" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="City" half>
              <input type="text" value={institutionCity} onChange={e => setInstitutionCity(e.target.value)} className={inputCls} placeholder="City" />
            </Field>
            <Field label="Address" half>
              <input type="text" value={institutionAddress} onChange={e => setInstitutionAddress(e.target.value)} className={inputCls} placeholder="Street address" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Bank Account Number" half>
              <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className={inputCls} placeholder="Account number" />
            </Field>
            <Field label="Bank Name" half>
              <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className={inputCls} placeholder="Bank name" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Bank Code" half>
              <input type="text" value={bankCode} onChange={e => setBankCode(e.target.value)} className={inputCls} placeholder="058" />
            </Field>
            <Field label="Contact Person" half>
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputCls} placeholder="Bursar name" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Contact Email" half>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputCls} placeholder="bursar@university.edu" />
            </Field>
            <Field label="Contact Phone" half>
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputCls} placeholder="+234..." />
            </Field>
          </div>
        </Section>

        {/* Program Details */}
        <Section title="Program Details">
          <Field label="Program Name">
            <input type="text" value={programName} onChange={e => setProgramName(e.target.value)} className={inputCls} placeholder="B.Sc Computer Science" />
          </Field>
          <div className="flex gap-3">
            <Field label="Duration (Years)" half>
              <input type="number" value={programDuration} onChange={e => setProgramDuration(e.target.value)} min="1" max="10" className={inputCls} placeholder="4" />
            </Field>
            <Field label="Current Year" half>
              <input type="number" value={currentYear} onChange={e => setCurrentYear(e.target.value)} min="1" max="10" className={inputCls} placeholder="2" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Admission Number" half>
              <input type="text" value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} className={inputCls} placeholder="ADM/2024/001" />
            </Field>
            <Field label="Admission Letter ID" half>
              <input type="text" value={admissionLetterId} onChange={e => setAdmissionLetterId(e.target.value)} className={inputCls} placeholder="LTR-001" />
            </Field>
          </div>
        </Section>

        {/* Financial Terms */}
        <Section title="Financial Terms">
          <div className="flex gap-3">
            <Field label="Tuition Fee/Year (₦)" half>
              <input type="number" value={tuitionFee} onChange={e => setTuitionFee(e.target.value)} min="0" step="1000" className={inputCls} placeholder="0.00" />
            </Field>
            <Field label="Accommodation/Year (₦)" half>
              <input type="number" value={accommodation} onChange={e => setAccommodation(e.target.value)} min="0" step="1000" className={inputCls} placeholder="0.00" />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Books & Materials (₦)" half>
              <input type="number" value={booksAndMaterials} onChange={e => setBooksAndMaterials(e.target.value)} min="0" step="1000" className={inputCls} placeholder="0.00" />
            </Field>
            <Field label="Living Expenses (₦)" half>
              <input type="number" value={livingExpenses} onChange={e => setLivingExpenses(e.target.value)} min="0" step="1000" className={inputCls} placeholder="0.00" />
            </Field>
          </div>
          <Field label="Requested Amount (₦) *">
            <input type="number" value={requestedAmount} onChange={e => setRequestedAmount(e.target.value)} min="0" step="1000" className={inputCls} placeholder="0.00" required />
          </Field>
          <Field label="Repayment Type">
            <select value={repaymentType} onChange={e => setRepaymentType(e.target.value)} className={selectCls}>
              <option value="">Select type</option>
              {REPAYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </Field>
          <div className="flex gap-3">
            <Field label="Moratorium (Months)" half>
              <input type="number" value={moratoriumMonths} onChange={e => setMoratoriumMonths(e.target.value)} min="0" max="24" className={inputCls} placeholder="6" />
            </Field>
            <Field label="Repayment Tenor (Months)" half>
              <input type="number" value={repaymentTenor} onChange={e => setRepaymentTenor(e.target.value)} min="1" max="120" className={inputCls} placeholder="60" />
            </Field>
          </div>
        </Section>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary-color)' }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Update Application'
          )}
        </button>
      </form>
    </div>
  );
};

export default EducationLoanUpdateScreen;
