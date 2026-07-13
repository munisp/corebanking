import { AppConfig } from '../config/app_config';
import { apiService } from './api_service';

export interface Reward {
  id: string;
  userId: string;
  title: string;
  description: string;
  points: number;
  category: 'cashback' | 'bonus' | 'milestone' | 'referral' | 'streak';
  date: Date;
  transactionId?: string;
}

export interface RewardSummary {
  totalPoints: number;
  earnedThisMonth: number;
  redeemedThisMonth: number;
  tier: string;
  nextTierPoints: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
}

export interface RedeemOption {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface RedemptionHistory {
  id: string;
  optionId: string;
  title: string;
  pointsSpent: number;
  date: Date;
  status: 'pending' | 'completed' | 'failed';
  trackingNumber?: string;
}

export class RewardService {
  // Get user rewards summary
  async getRewardSummary(): Promise<RewardSummary> {
    try {
      const response = await apiService.get(`${AppConfig.rewardEndpoint}/summary`);
      
      const data = response.data as { success?: boolean; data?: any };
      if (data.success || response.status === 200) {
        const summary = data.data || {};
        return {
          totalPoints: summary.total_points || 0,
          earnedThisMonth: summary.earned_this_month || 0,
          redeemedThisMonth: summary.redeemed_this_month || 0,
          tier: summary.tier || 'Bronze',
          nextTierPoints: summary.next_tier_points || 0,
          lifetimeEarned: summary.lifetime_earned || 0,
          lifetimeRedeemed: summary.lifetime_redeemed || 0,
        };
      }
      return {
        totalPoints: 0,
        earnedThisMonth: 0,
        redeemedThisMonth: 0,
        tier: 'Bronze',
        nextTierPoints: 1000,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
      };
    } catch (error) {
      console.error('Failed to fetch reward summary:', error);
      return {
        totalPoints: 0,
        earnedThisMonth: 0,
        redeemedThisMonth: 0,
        tier: 'Bronze',
        nextTierPoints: 1000,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
      };
    }
  }

  // Get earned rewards history
  async getEarnedRewards(): Promise<Reward[]> {
    try {
      const response = await apiService.get(`${AppConfig.rewardEndpoint}/earned`);
      
      const data = response.data as { success?: boolean; data?: Record<string, unknown>[] };
      if (data.success || response.status === 200) {
        const rewardsData = data.data as Record<string, unknown>[];
        return rewardsData.map((reward) => ({
          id: reward.id as string,
          userId: reward.user_id as string,
          title: reward.title as string,
          description: reward.description as string,
          points: reward.points as number,
          category: reward.category as Reward['category'],
          date: new Date(reward.date as string),
          transactionId: reward.transaction_id as string | undefined,
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch earned rewards:', error);
      return [];
    }
  }

  // Get available redemption options
  async getRedeemOptions(): Promise<RedeemOption[]> {
    try {
      const response = await apiService.get(`${AppConfig.rewardEndpoint}/redeem-options`);
      
      const data = response.data as { success?: boolean; data?: Record<string, unknown>[] };
      if (data.success || response.status === 200) {
        const optionsData = data.data as Record<string, unknown>[];
        return optionsData.map((option) => ({
          id: option.id as string,
          title: option.title as string,
          description: option.description as string,
          pointsRequired: option.points_required as number,
          category: option.category as string,
          imageUrl: option.image_url as string | undefined,
          isAvailable: option.is_available as boolean,
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch redeem options:', error);
      return [];
    }
  }

  // Redeem reward points
  async redeemPoints(optionId: string, deliveryInfo?: Record<string, unknown>): Promise<{ success: boolean; message: string; data?: RedemptionHistory }> {
    try {
      const response = await apiService.post(`${AppConfig.rewardEndpoint}/redeem`, {
        option_id: optionId,
        delivery_info: deliveryInfo,
      });

      const data = response.data as { success?: boolean; message?: string; data?: any };
      if (data.success || response.status === 200) {
        return {
          success: true,
          message: data.message || 'Reward redeemed successfully',
          data: data.data ? {
            id: data.data.id,
            optionId: data.data.option_id,
            title: data.data.title,
            pointsSpent: data.data.points_spent,
            date: new Date(data.data.date),
            status: data.data.status,
            trackingNumber: data.data.tracking_number,
          } : undefined,
        };
      }
      return {
        success: false,
        message: data.message || 'Failed to redeem reward',
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error redeeming reward',
      };
    }
  }

  // Get redemption history
  async getRedemptionHistory(): Promise<RedemptionHistory[]> {
    try {
      const response = await apiService.get(`${AppConfig.rewardEndpoint}/redemption-history`);
      
      const data = response.data as { success?: boolean; data?: Record<string, unknown>[] };
      if (data.success || response.status === 200) {
        const historyData = data.data as Record<string, unknown>[];
        return historyData.map((item) => ({
          id: item.id as string,
          optionId: item.option_id as string,
          title: item.title as string,
          pointsSpent: item.points_spent as number,
          date: new Date(item.date as string),
          status: item.status as RedemptionHistory['status'],
          trackingNumber: item.tracking_number as string | undefined,
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch redemption history:', error);
      return [];
    }
  }

  // Get rewards by category
  async getRewardsByCategory(category: string): Promise<Reward[]> {
    try {
      const response = await apiService.get(`${AppConfig.rewardEndpoint}/earned?category=${category}`);
      
      const data = response.data as { success?: boolean; data?: Record<string, unknown>[] };
      if (data.success || response.status === 200) {
        const rewardsData = data.data as Record<string, unknown>[];
        return rewardsData.map((reward) => ({
          id: reward.id as string,
          userId: reward.user_id as string,
          title: reward.title as string,
          description: reward.description as string,
          points: reward.points as number,
          category: reward.category as Reward['category'],
          date: new Date(reward.date as string),
          transactionId: reward.transaction_id as string | undefined,
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch rewards by category:', error);
      return [];
    }
  }
}

export const rewardService = new RewardService();
