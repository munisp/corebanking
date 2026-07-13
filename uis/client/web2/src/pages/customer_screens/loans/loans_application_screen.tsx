import React, { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { loanService } from "../../../services/loan_service";

export default function LoansApplicationScreen() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [otherPurpose, setOtherPurpose] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [estimatedInterest, setEstimatedInterest] = useState(0);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const interestRate = 15; // Annual interest rate

  const loanPurposes = [
    "Business Expansion",
    "Working Capital",
    "Equipment Purchase",
    "Inventory",
    "Property Purchase",
    "Emergency Funds",
    "Other",
  ];

  useEffect(() => {
    const amt = parseFloat(amount) || 0;
    const trm = parseInt(term) || 0;
    if (amt > 0 && trm > 0) {
      const totalInterest = amt * (interestRate / 100) * (trm / 12);
      const totalAmount = amt + totalInterest;
      setEstimatedInterest(totalInterest);
      setMonthlyPayment(totalAmount / trm);
    } else {
      setEstimatedInterest(0);
      setMonthlyPayment(0);
    }
  }, [amount, term]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const amt = parseFloat(amount);
    const trm = parseInt(term);

    if (!amount) newErrors.amount = "Enter loan amount";
    else if (isNaN(amt) || amt < 10000 || amt > 5000000)
      newErrors.amount = "Amount must be between ₦10,000 and ₦5,000,000";

    if (!term) newErrors.term = "Enter loan term";
    else if (isNaN(trm) || trm < 1 || trm > 60) newErrors.term = "Term must be between 1-60 months";

    if (!selectedPurpose) newErrors.purpose = "Select a purpose";
    if (selectedPurpose === "Other" && !otherPurpose) newErrors.otherPurpose = "Specify purpose";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await loanService.applyForLoan({
        amount: parseFloat(amount),
        termInMonths: parseInt(term),
        purpose: selectedPurpose === "Other" ? otherPurpose : selectedPurpose!,
      });
      alert(
        `Application Submitted Successfully!\nAmount: ₦${parseFloat(amount).toFixed(
          2
        )}\nTerm: ${term} months\nMonthly Payment: ₦${monthlyPayment.toFixed(2)}\n\nYour application is being reviewed.`
      );
      navigate('/loans');
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../../utils/error_utils');
      alert("Error submitting loan application: " + getErrorMessage(err, 'Failed to submit loan application'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildInput = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    error?: string,
    type: React.HTMLInputTypeAttribute = "text",
    placeholder?: string
  ) => (
    <div className="mb-4">
      <label className="block font-medium mb-1 text-gray-900 dark:text-white">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 dark:text-white ${
          error ? "border-red-500 ring-red-200" : "border-gray-300 dark:border-gray-700 ring-[var(--primary-color)]"
        }`}
      />
      {error && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{error}</p>}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 w-full min-h-screen">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-700 dark:text-gray-300 hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)] transition"
        >
          <FiArrowLeft size={20} className="mr-2" />
          Back to Dashboard
        </button>
      </div>
      
      {/* Header */}
      <div className="bg-linear-to-r from-[var(--primary-color)] to-[var(--secondary-color)]   p-6 rounded-xl text-white mb-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Quick Loan Application</h1>
        <p>Get funds in 24-48 hours</p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
        {buildInput("Loan Amount (₦)", amount, setAmount, errors.amount, "number", "e.g., 500000")}
        <small className="text-gray-600 dark:text-gray-400 block mb-4">Min: ₦10,000 • Max: ₦5,000,000</small>

        {buildInput("Term (months)", term, setTerm, errors.term, "number", "1-60 months")}

        <div className="mb-4">
          <label className="block font-medium mb-1 text-gray-900 dark:text-white">Loan Purpose</label>
          <select
            value={selectedPurpose || ""}
            onChange={(e) => setSelectedPurpose(e.target.value)}
           
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 dark:text-white ${
              errors.purpose ? "border-red-500 ring-red-200" : "border-gray-300 dark:border-gray-700 ring-[var(--primary-color)]"
            }`}
          >
            <option value="">Select Purpose</option>
            {loanPurposes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.purpose && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.purpose}</p>}
        </div>

        {selectedPurpose === "Other" &&
          buildInput("Specify Purpose", otherPurpose, setOtherPurpose, errors.otherPurpose, "text")}
      </div>

      {/* Loan Summary */}
      {monthlyPayment > 0 && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-6">
          <h2 className="font-bold mb-2 text-gray-900 dark:text-white">Loan Summary</h2>
          <p className="text-gray-800 dark:text-gray-300">Interest Rate: {interestRate}% per annum</p>
          <p className="text-gray-800 dark:text-gray-300">Estimated Interest: ₦{estimatedInterest.toFixed(2)}</p>
          <p className="font-semibold text-green-900 dark:text-green-400">Monthly Payment: ₦{monthlyPayment.toFixed(2)}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={`w-full py-3 rounded-xl text-white font-bold ${
          isSubmitting ? "bg-gray-400 dark:bg-gray-600" : "bg-[var(--primary-color)] dark:bg-[var(--primary-color)] hover:bg-[var(--primary-color)] dark:hover:bg-[var(--primary-color)]"
        }`}
      >
        {isSubmitting ? "Submitting..." : "Submit Application"}
      </button>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-[var(--primary-color)]/30 border border-[var(--primary-color)] dark:border-[var(--primary-color)] rounded-lg flex items-start">
        <svg className="w-5 h-5 text-[var(--primary-color)] dark:text-[var(--primary-color)] mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a7 7 0 100 14A7 7 0 009 2zM8 7h2v5H8V7zm1 7a1 1 0 110 2 1 1 0 010-2z" />
        </svg>
        <p className="text-[var(--primary-color)] dark:text-[var(--primary-color)] text-sm">
          Your application will be reviewed within 24 hours. Interest rates and terms are subject to approval.
        </p>
      </div>
    </div>
  );
}
