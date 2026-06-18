import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const CreditsRewardsScreen = () => {
  const navigate = useNavigate();
  const rewards = [
    { id: 1, title: 'Welcome Bonus', points: 1500, icon: '🎁' },
    { id: 2, title: 'Bill Payment Cashback', points: 300, icon: '💵' },
    { id: 3, title: 'Savings Streak', points: 800, icon: '⭐' },
    { id: 4, title: 'Referral Bonus', points: 500, icon: '👥' },
  ];

  const totalPoints = rewards.reduce((sum, r) => sum + r.points, 0);

  const handleRedeem = () => {
    alert('Redeem action - API integration needed');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-700 hover:text-[var(--primary-color)] transition"
          >
            <FiArrowLeft size={20} className="mr-2" />
            Back
          </button>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Credits & Rewards</h1>

        {/* Total Points Card */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-400 rounded-2xl p-6 shadow-lg mb-6 text-white">
          <p className="text-sm opacity-90 mb-1">Total Reward Points</p>
          <p className="text-4xl font-bold mb-4">{totalPoints.toLocaleString()}</p>
          <button
            onClick={handleRedeem}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Redeem Points
          </button>
        </div>

        {/* Rewards List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Your Rewards</h2>
          {rewards.map((reward) => (
            <div key={reward.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{reward.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{reward.title}</h3>
                    <p className="text-sm text-gray-500">Mock data — replace with API</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-purple-600">{reward.points}</p>
                  <p className="text-xs text-gray-500">points</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-[var(--primary-color)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--primary-color)] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-[var(--primary-color)]">
              <p className="font-semibold mb-1">How to earn more points</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Complete transactions regularly</li>
                <li>Refer friends to 54link-dev</li>
                <li>Maintain savings streak</li>
                <li>Pay bills on time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditsRewardsScreen;
