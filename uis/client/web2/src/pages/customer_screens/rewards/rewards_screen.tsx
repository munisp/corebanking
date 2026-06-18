import { useEffect, useState } from 'react';
import { FiArrowLeft, FiAward, FiChevronRight, FiGift, FiStar, FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import { rewardService, type RedeemOption as RedeemOptionType, type RewardSummary, type Reward as RewardType } from '../../../services/reward_service';

const RewardsScreen = () => {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useTenantConfig();
  const [activeTab, setActiveTab] = useState<'earn' | 'redeem'>('earn');
  const [loading, setLoading] = useState(true);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [earnedRewards, setEarnedRewards] = useState<RewardType[]>([]);
  const [redeemOptions, setRedeemOptions] = useState<RedeemOptionType[]>([]);

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      setLoading(true);
      const [summaryData, earnedData, optionsData] = await Promise.all([
        rewardService.getRewardSummary(),
        rewardService.getEarnedRewards(),
        rewardService.getRedeemOptions(),
      ]);
      
      setSummary(summaryData);
      setEarnedRewards(earnedData);
      setRedeemOptions(optionsData);
    } catch (error) {
      console.error('Failed to load rewards data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('bonus') || cat === 'bonus') return 'star';
    if (cat.includes('cashback') || cat === 'cashback') return 'gift';
    if (cat.includes('streak') || cat === 'streak') return 'trending';
    if (cat.includes('milestone') || cat === 'milestone') return 'star';
    if (cat.includes('referral') || cat === 'referral') return 'gift';
    return 'star';
  };

  const getIconComponent = (iconType: string) => {
    switch (iconType) {
      case 'star':
        return <FiStar className="text-yellow-500" size={18} />;
      case 'gift':
        return <FiGift className="text-pink-500" size={18} />;
      case 'trending':
        return <FiTrendingUp className="text-green-500" size={18} />;
      default:
        return <FiStar className="text-yellow-500" size={18} />;
    }
  };

  const handleRedeem = async (option: RedeemOptionType) => {
    if (!summary) return;

    if (summary.totalPoints >= option.pointsRequired) {
      const confirmed = window.confirm(
        `Redeem ${option.title} for ${option.pointsRequired} points?\n\nYour new balance will be ${summary.totalPoints - option.pointsRequired} points.`
      );
      
      if (confirmed) {
        try {
          setRedeemLoading(true);
          const response = await rewardService.redeemPoints(option.id);
          
          if (response.success) {
            alert(response.message);
            loadRewardsData(); // Reload to update points balance
          } else {
            alert(response.message);
          }
        } catch (error) {
          alert('Failed to redeem reward. Please try again.');
        } finally {
          setRedeemLoading(false);
        }
      }
    } else {
      alert(`Insufficient points. You need ${option.pointsRequired - summary.totalPoints} more points.`);
    }
  };

  const progressPercent = summary
    ? (summary.totalPoints / summary.nextTierPoints) * 100
    : 0;

  if (!isFeatureEnabled('gamification')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-purple-50 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiGift className="w-10 h-10 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Rewards Not Available</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">The rewards and gamification feature is not enabled for your account. Contact support to enable this feature.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading rewards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-linear-to-br from-purple-600 to-pink-500 pt-4 pb-8">
        <div className="px-4 flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white hover:text-gray-200"
          >
            <FiArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Rewards</h1>
            <p className="text-sm text-purple-100">Earn points, get rewards</p>
          </div>
          <FiAward className="text-white" size={28} />
        </div>

        {/* Points Card */}
        <div className="px-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-white/80 text-sm mb-1">Your Points</p>
                <p className="text-white text-4xl font-bold">
                  {summary?.totalPoints.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-white/30 px-3 py-1.5 rounded-full">
                <p className="text-white text-sm font-semibold">{summary?.tier || 'Bronze'} Tier</p>
              </div>
            </div>

            {/* Progress to Next Tier */}
            <div className="mt-4">
              <div className="flex justify-between text-white/90 text-xs mb-2">
                <span>Progress to Next Tier</span>
                <span>
                  {summary
                    ? `${summary.nextTierPoints - summary.totalPoints} points needed`
                    : '0 points needed'}
                </span>
              </div>
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex">
          <button
            onClick={() => setActiveTab('earn')}
            className={`flex-1 py-4 text-center font-semibold transition-colors relative ${
              activeTab === 'earn' ? 'text-purple-600' : 'text-gray-500'
            }`}
          >
            Earn Points
            {activeTab === 'earn' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('redeem')}
            className={`flex-1 py-4 text-center font-semibold transition-colors relative ${
              activeTab === 'redeem' ? 'text-purple-600' : 'text-gray-500'
            }`}
          >
            Redeem
            {activeTab === 'redeem' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'earn' ? (
        <div className="px-4 py-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">How to Earn Points</h2>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <FiStar className="text-purple-600 mt-1" size={20} />
                <div>
                  <p className="font-semibold text-gray-900">Complete Transactions</p>
                  <p className="text-sm text-gray-600">Earn 1 point for every ₦100 spent</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <FiGift className="text-pink-600 mt-1" size={20} />
                <div>
                  <p className="font-semibold text-gray-900">Pay Bills</p>
                  <p className="text-sm text-gray-600">Get 2% cashback in points</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <FiTrendingUp className="text-green-600 mt-1" size={20} />
                <div>
                  <p className="font-semibold text-gray-900">Save Regularly</p>
                  <p className="text-sm text-gray-600">Bonus points for 7-day saving streaks</p>
                </div>
              </li>
            </ul>
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Points</h2>
          {earnedRewards.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y dark:divide-gray-700">
              {earnedRewards.map((reward) => {
                const iconType = getCategoryIcon(reward.category);
                return (
                  <div key={reward.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-full">
                        {getIconComponent(iconType)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{reward.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(reward.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-green-600 dark:text-green-400">+{reward.points}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <FiGift className="text-gray-400 dark:text-gray-500 mx-auto mb-3" size={48} />
              <p className="text-gray-600 dark:text-gray-400">No rewards earned yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Start transacting to earn reward points
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Redeem Your Points</h2>
          {redeemOptions.length > 0 ? (
            <div className="space-y-4">
              {redeemOptions.map((option) => {
                const canRedeem = summary ? summary.totalPoints >= option.pointsRequired : false;
                return (
                  <div
                    key={option.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border transition-all ${
                      canRedeem
                        ? 'border-gray-100 dark:border-gray-700 hover:shadow-md'
                        : 'border-gray-100 dark:border-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-5xl">
                        {option.imageUrl ? (
                          <img src={option.imageUrl} alt={option.title} className="w-16 h-16 object-cover rounded-lg" />
                        ) : (
                          '🎁'
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">{option.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{option.description}</p>
                          </div>
                          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2 py-1 rounded-full font-semibold">
                            {option.category}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            <FiStar className="text-yellow-500" size={18} />
                            <span className="font-bold text-gray-900 dark:text-white">
                              {option.pointsRequired.toLocaleString()} points
                            </span>
                          </div>
                          <button
                            onClick={() => handleRedeem(option)}
                            disabled={!canRedeem || redeemLoading || !option.isAvailable}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                              canRedeem && option.isAvailable
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {redeemLoading ? 'Redeeming...' : 'Redeem'}
                            <FiChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <FiGift className="text-gray-400 dark:text-gray-500 mx-auto mb-3" size={48} />
              <p className="text-gray-600 dark:text-gray-400">No redemption options available</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Check back later for exciting rewards
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RewardsScreen;
