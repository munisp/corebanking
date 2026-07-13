import { CheckCircleIcon, InformationCircleIcon } from "@heroicons/react/24/solid";
import React, { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
// import { useNavigate } from "react-router-dom";
import { PaymentService } from "../../../services/payment_service"; // Your service

interface Category {
  id: string;
  name: string;
}

interface Biller {
  id: string;
  name: string;
}

interface CustomerInfo {
  customer_name?: string;
  outstanding_balance?: number;
}

const BillPaymentScreen: React.FC = () => {
  const paymentService = new PaymentService();

  const [categories, setCategories] = useState<Category[]>([]);
  const [billers, setBillers] = useState<Biller[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBiller, setSelectedBiller] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingBillers, setIsLoadingBillers] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await paymentService.getBillerCategories();
        setCategories(cats);
      } catch (err) {
        alert(`Failed to load categories: ${err}`);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  // Load billers
  const loadBillers = async (categoryId: string) => {
    setIsLoadingBillers(true);
    setBillers([]);
    setSelectedBiller(null);
    try {
      const bls = await paymentService.getBillers(categoryId);
      setBillers(bls);
    } catch (err) {
      alert(`Failed to load billers: ${err}`);
    } finally {
      setIsLoadingBillers(false);
    }
  };

  // Validate customer
  const validateCustomer = async () => {
    if (!selectedBiller) return alert("Please select a biller");
    if (!customerId) return alert("Please enter customer ID");

    setIsValidating(true);
    setCustomerInfo(null);

    try {
      const info = await paymentService.validateCustomer(
        selectedBiller,
        customerId
      );
      setCustomerInfo(info);
    } catch (err) {
      alert(`Validation failed: ${err}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Process payment
  const processPayment = async () => {
    if (!selectedBiller || !customerId || !amount) return alert("Please complete all fields");
    if (!customerInfo) return alert("Please validate customer first");

    const confirmed = window.confirm(
      `Confirm payment of ₦${amount} to ${customerInfo.customer_name || customerId}?`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await paymentService.payBill({
        billerId: selectedBiller,
        customerId,
        amount: parseFloat(amount),
      });
      alert("Payment successful!");
      // Reset form
      setSelectedCategory(null);
      setSelectedBiller(null);
      setCustomerId("");
      setAmount("");
      setCustomerInfo(null);
      setBillers([]);
    } catch (err) {
      alert(`Payment failed: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 md:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center text-gray-700 dark:text-gray-300 hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)] transition"
          >
            <FiArrowLeft size={20} className="mr-2" />
            Back
          </button>
        </div>
        
        {/* Header */}
        <div className="bg-gradient-to-r var(--primary-color) to-green-500 p-6 rounded-xl shadow-md mb-6 text-white">
          <div className="flex items-center">
            <div className="p-3 bg-white bg-opacity-20 rounded-full mr-4">
              <CheckCircleIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pay Your Bills</h1>
              <p className="text-sm text-white/70">
                Electricity, Cable TV, Internet & more
              </p>
            </div>
          </div>
        </div>

        {isLoadingCategories ? (
          <div className="text-center py-10">
            <div className="loader mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Loading bill categories...</p>
          </div>
        ) : (
          <form className="space-y-4">
            {/* Category */}
            <select
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-800 dark:text-white"
              value={selectedCategory || ""}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedBiller(null);
                setCustomerInfo(null);
                setCustomerId("");
                setAmount("");
                if (e.target.value) loadBillers(e.target.value);
              }}
            >
              <option value="" disabled>
                Select Category
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Biller */}
            {selectedCategory && (
              <>
                {isLoadingBillers ? (
                  <p className="text-gray-500 dark:text-gray-400">Loading billers...</p>
                ) : (
                  <select
                    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-800 dark:text-white"
                    value={selectedBiller || ""}
                    onChange={(e) => {
                      setSelectedBiller(e.target.value);
                      setCustomerInfo(null);
                      setCustomerId("");
                      setAmount("");
                    }}
                  >
                    <option value="" disabled>
                      Select Biller
                    </option>
                    {billers.map((biller) => (
                      <option key={biller.id} value={biller.id}>
                        {biller.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            {/* Customer ID */}
            {selectedBiller && (
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-800 dark:text-white"
                  type="text"
                  placeholder="Customer ID / Meter Number"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setCustomerInfo(null);
                  }}
                />
                <button
                  type="button"
                  onClick={validateCustomer}
                  disabled={isValidating}
                  className="px-4 py-2 bg-[var(--primary-color)] dark:bg-[var(--primary-color)] text-white rounded-lg disabled:opacity-50"
                >
                  {isValidating ? "Validating..." : "Validate"}
                </button>
              </div>
            )}

            {/* Customer Info */}
            {customerInfo && (
              <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-white">Customer Verified</p>
                {customerInfo.customer_name && (
                  <p className="text-gray-800 dark:text-gray-300">Name: {customerInfo.customer_name}</p>
                )}
                {customerInfo.outstanding_balance && (
                  <p className="text-red-600 dark:text-red-400">
                    Outstanding: ₦{customerInfo.outstanding_balance}
                  </p>
                )}
              </div>
            )}

            {/* Amount */}
            {customerInfo && (
              <>
                <input
                  type="number"
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-[var(--primary-color)]/30 p-2 rounded-md text-[var(--primary-color)] dark:text-[var(--primary-color)] text-sm">
                  <InformationCircleIcon className="w-5 h-5" />
                  Payment will be processed instantly
                </div>
              </>
            )}

            {/* Pay Button */}
            {customerInfo && (
              <button
                type="button"
                onClick={processPayment}
                disabled={isProcessing}
                className="w-full p-4 bg-[var(--primary-color)] dark:bg-[var(--primary-color)] text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Pay Now"}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default BillPaymentScreen;
