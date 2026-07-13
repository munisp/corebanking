import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const FaqScreen = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page and click on "Forgot Password". Enter your email address and we will send you a password reset link. Follow the instructions in the email to create a new password.',
    },
    {
      question: 'How do I create a PIN?',
      answer: 'After logging in, go to Settings > Security > Create PIN. Enter a 4-digit PIN of your choice and confirm it. This PIN will be used to authorize transactions.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, we use bank-grade encryption (256-bit SSL) to protect all your data. We also implement multi-factor authentication and regular security audits to ensure your information is safe.',
    },
    {
      question: 'How long do transfers take?',
      answer: 'Transfers to 54link-dev accounts are instant. Transfers to other banks typically take 5-30 minutes during banking hours and may take longer outside banking hours.',
    },
    {
      question: 'What are the transaction limits?',
      answer: 'Daily transfer limit is ₦500,000 for regular accounts and ₦2,000,000 for premium accounts. You can request limit increases by contacting customer support.',
    },
    {
      question: 'How do I report a fraudulent transaction?',
      answer: 'Immediately contact our 24/7 hotline at +234-800-123-4567 or use the in-app chat support. You can also email us at security@54link-dev.com. We will investigate and resolve the issue promptly.',
    },
    {
      question: 'Can I use the app offline?',
      answer: 'You can view your transaction history and account balance offline, but you need an internet connection to make transfers, payments, or any transactions.',
    },
    {
      question: 'How do I upgrade my account?',
      answer: 'Go to Settings > Account > Upgrade Account. Complete the required KYC verification steps including BVN verification and document upload to upgrade your account tier.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center text-gray-700 hover:text-[var(--primary-color)] transition"
          >
            <FiArrowLeft size={20} className="mr-2" />
            Back to Settings
          </button>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-600 mb-6">Find answers to common questions</p>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full p-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-800 pr-4">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    openIndex === index ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5 text-gray-600 border-t">
                  <p className="pt-4">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-8 bg-blue-50 border border-[var(--primary-color)] rounded-xl p-6 text-center">
          <h2 className="font-semibold text-gray-800 mb-2">Still have questions?</h2>
          <p className="text-gray-600 mb-4">Our support team is here to help</p>
          <a
            href="/support"
            className="inline-block bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default FaqScreen;
