import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const BeneficiariesScreen = () => {
  const navigate = useNavigate();

  const beneficiaries = [
    { id: 1, name: 'John Doe', account: '0123456789', bank: 'GT Bank' },
    { id: 2, name: 'Ada Love', account: '2233445566', bank: 'First Bank' },
    { id: 3, name: 'Chidi Okafor', account: '9988776655', bank: 'Access Bank' },
  ];

  const handleTransfer = (beneficiary: typeof beneficiaries[0]) => {
    alert(`Initiating transfer to ${beneficiary.name}`);
    navigate('/transfer', { state: { beneficiary } });
  };

  const handleAdd = () => {
    alert('Add beneficiary form - API integration needed');
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to remove this beneficiary?')) {
      alert(`Beneficiary ${id} removed`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/transfer')}
            className="flex items-center text-gray-700 dark:text-gray-300 hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)] transition"
          >
            <FiArrowLeft size={20} className="mr-2" />
            Back to Transfer
          </button>
        </div>
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Saved Beneficiaries</h1>
          <button
            onClick={handleAdd}
            className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New
          </button>
        </div>

        <div className="space-y-3">
          {beneficiaries.map((beneficiary) => (
            <div key={beneficiary.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--primary-color)] dark:bg-[var(--primary-color)]/30 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--primary-color)] dark:text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">{beneficiary.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{beneficiary.bank}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Acct: {beneficiary.account}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTransfer(beneficiary)}
                    className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg"
                    title="Send Money"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(beneficiary.id)}
                    className="bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 p-2 rounded-lg"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {beneficiaries.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No beneficiaries saved yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeneficiariesScreen;
