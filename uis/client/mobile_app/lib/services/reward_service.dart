import '../config/app_config.dart';
import 'api_service.dart';

// Type definitions
class Reward {
  final String id;
  final String userId;
  final String title;
  final String description;
  final int points;
  final String category; // 'cashback' | 'bonus' | 'milestone' | 'referral' | 'streak'
  final DateTime date;
  final String? transactionId;

  Reward({
    required this.id,
    required this.userId,
    required this.title,
    required this.description,
    required this.points,
    required this.category,
    required this.date,
    this.transactionId,
  });

  factory Reward.fromJson(Map<String, dynamic> json) {
    return Reward(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      points: json['points'] as int,
      category: json['category'] as String,
      date: DateTime.parse(json['date'] as String),
      transactionId: json['transaction_id'] as String?,
    );
  }
}

class RewardSummary {
  final int totalPoints;
  final int earnedThisMonth;
  final int redeemedThisMonth;
  final String tier;
  final int nextTierPoints;
  final int lifetimeEarned;
  final int lifetimeRedeemed;

  RewardSummary({
    required this.totalPoints,
    required this.earnedThisMonth,
    required this.redeemedThisMonth,
    required this.tier,
    required this.nextTierPoints,
    required this.lifetimeEarned,
    required this.lifetimeRedeemed,
  });
}

class RedeemOption {
  final String id;
  final String title;
  final String description;
  final int pointsRequired;
  final String category;
  final String? imageUrl;
  final bool isAvailable;

  RedeemOption({
    required this.id,
    required this.title,
    required this.description,
    required this.pointsRequired,
    required this.category,
    this.imageUrl,
    required this.isAvailable,
  });

  factory RedeemOption.fromJson(Map<String, dynamic> json) {
    return RedeemOption(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      pointsRequired: json['points_required'] as int,
      category: json['category'] as String,
      imageUrl: json['image_url'] as String?,
      isAvailable: json['is_available'] as bool,
    );
  }
}

class RedemptionHistory {
  final String id;
  final String optionId;
  final String title;
  final int pointsSpent;
  final DateTime date;
  final String status; // 'pending' | 'completed' | 'failed'
  final String? trackingNumber;

  RedemptionHistory({
    required this.id,
    required this.optionId,
    required this.title,
    required this.pointsSpent,
    required this.date,
    required this.status,
    this.trackingNumber,
  });

  factory RedemptionHistory.fromJson(Map<String, dynamic> json) {
    return RedemptionHistory(
      id: json['id'] as String,
      optionId: json['option_id'] as String,
      title: json['title'] as String,
      pointsSpent: json['points_spent'] as int,
      date: DateTime.parse(json['date'] as String),
      status: json['status'] as String,
      trackingNumber: json['tracking_number'] as String?,
    );
  }
}

class RewardService {
  final ApiService _apiService = ApiService();

  // Get user rewards summary
  Future<RewardSummary> getRewardSummary() async {
    try {
      final response = await _apiService.get('${AppConfig.rewardEndpoint}/summary');

      if (response.data['success'] == true || response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>;
        return RewardSummary(
          totalPoints: data['total_points'] ?? 0,
          earnedThisMonth: data['earned_this_month'] ?? 0,
          redeemedThisMonth: data['redeemed_this_month'] ?? 0,
          tier: data['tier'] ?? 'Bronze',
          nextTierPoints: data['next_tier_points'] ?? 0,
          lifetimeEarned: data['lifetime_earned'] ?? 0,
          lifetimeRedeemed: data['lifetime_redeemed'] ?? 0,
        );
      }

      // Return default summary if API fails
      return RewardSummary(
        totalPoints: 0,
        earnedThisMonth: 0,
        redeemedThisMonth: 0,
        tier: 'Bronze',
        nextTierPoints: 1000,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
      );
    } catch (error) {
      print('Failed to fetch reward summary: $error');
      return RewardSummary(
        totalPoints: 0,
        earnedThisMonth: 0,
        redeemedThisMonth: 0,
        tier: 'Bronze',
        nextTierPoints: 1000,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
      );
    }
  }

  // Get earned rewards history
  Future<List<Reward>> getEarnedRewards() async {
    try {
      final response = await _apiService.get('${AppConfig.rewardEndpoint}/earned');

      if (response.data['success'] == true || response.statusCode == 200) {
        final rewardsData = response.data['data'] as List<dynamic>;
        return rewardsData.map((reward) => Reward.fromJson(reward as Map<String, dynamic>)).toList();
      }

      return [];
    } catch (error) {
      print('Failed to fetch earned rewards: $error');
      return [];
    }
  }

  // Get available redemption options
  Future<List<RedeemOption>> getRedeemOptions() async {
    try {
      final response = await _apiService.get('${AppConfig.rewardEndpoint}/redeem-options');

      if (response.data['success'] == true || response.statusCode == 200) {
        final optionsData = response.data['data'] as List<dynamic>;
        return optionsData.map((option) => RedeemOption.fromJson(option as Map<String, dynamic>)).toList();
      }

      return [];
    } catch (error) {
      print('Failed to fetch redeem options: $error');
      return [];
    }
  }

  // Redeem reward points
  Future<Map<String, dynamic>> redeemPoints(String optionId, {Map<String, dynamic>? deliveryInfo}) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.rewardEndpoint}/redeem',
        data: {
          'option_id': optionId,
          if (deliveryInfo != null) 'delivery_info': deliveryInfo,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Reward redeemed successfully',
          'data': response.data['data'] != null
              ? RedemptionHistory.fromJson(response.data['data'] as Map<String, dynamic>)
              : null,
        };
      }

      return {
        'success': false,
        'message': response.data['message'] ?? 'Failed to redeem reward',
      };
    } catch (error) {
      return {
        'success': false,
        'message': error.toString(),
      };
    }
  }

  // Get redemption history
  Future<List<RedemptionHistory>> getRedemptionHistory() async {
    try {
      final response = await _apiService.get('${AppConfig.rewardEndpoint}/redemption-history');

      if (response.data['success'] == true || response.statusCode == 200) {
        final historyData = response.data['data'] as List<dynamic>;
        return historyData.map((item) => RedemptionHistory.fromJson(item as Map<String, dynamic>)).toList();
      }

      return [];
    } catch (error) {
      print('Failed to fetch redemption history: $error');
      return [];
    }
  }

  // Get rewards by category
  Future<List<Reward>> getRewardsByCategory(String category) async {
    try {
      final response = await _apiService.get('${AppConfig.rewardEndpoint}/earned?category=$category');

      if (response.data['success'] == true || response.statusCode == 200) {
        final rewardsData = response.data['data'] as List<dynamic>;
        return rewardsData.map((reward) => Reward.fromJson(reward as Map<String, dynamic>)).toList();
      }

      return [];
    } catch (error) {
      print('Failed to fetch rewards by category: $error');
      return [];
    }
  }
}

