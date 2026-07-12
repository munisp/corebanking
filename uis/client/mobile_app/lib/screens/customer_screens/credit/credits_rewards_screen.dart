import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../services/reward_service.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _rewardService = RewardService();

  bool _isLoading = true;
  String? _error;
  RewardSummary? _summary;
  List<Reward> _earnedRewards = [];
  List<RedeemOption> _redeemOptions = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _rewardService.getRewardSummary(),
        _rewardService.getEarnedRewards(),
        _rewardService.getRedeemOptions(),
      ]);
      if (!mounted) return;
      setState(() {
        _summary = results[0] as RewardSummary;
        _earnedRewards = results[1] as List<Reward>;
        _redeemOptions = results[2] as List<RedeemOption>;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  IconData _categoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'cashback':
        return Icons.card_giftcard;
      case 'bonus':
        return Icons.star;
      case 'milestone':
        return Icons.flag;
      case 'referral':
        return Icons.people;
      case 'streak':
        return Icons.trending_up;
      default:
        return Icons.star;
    }
  }

  String _nextTierName(String currentTier) {
    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    final idx = tiers.indexWhere((t) => t.toLowerCase() == currentTier.toLowerCase());
    if (idx >= 0 && idx < tiers.length - 1) return tiers[idx + 1];
    return 'Max Tier';
  }

  String _formatDate(DateTime date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[date.month - 1]} ${date.day}';
  }

  void _handleRedeem(RedeemOption option) {
    final userPoints = _summary?.totalPoints ?? 0;
    if (userPoints >= option.pointsRequired) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Redeem Reward'),
          content: Text(
            'Redeeming ${option.title}. This will deduct ${option.pointsRequired} points.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Confirm')),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Insufficient points. You need ${option.pointsRequired - userPoints} more points.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    if (!tenantProvider.isFeatureEnabled('gamification')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Rewards')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.card_giftcard, size: 64, color: Colors.purple),
                SizedBox(height: 16),
                Text('Rewards Not Available', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                SizedBox(height: 8),
                Text(
                  'The rewards feature is not enabled for your account. Contact support to enable this feature.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Rewards')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                const Text(
                  'Failed to load rewards',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 16),
                ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    final summary = _summary!;
    final progressPercent = summary.nextTierPoints > 0
        ? (summary.totalPoints / summary.nextTierPoints).clamp(0.0, 1.0)
        : 0.0;
    final nextTierName = _nextTierName(summary.tier);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF9C27B0), Color(0xFFE91E63)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 60, 16, 16),
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withOpacity(0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Your Points',
                                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    summary.totalPoints.toString(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 36,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.3),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  '${summary.tier} Tier',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Progress to $nextTierName',
                                style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11),
                              ),
                              Text(
                                '${(summary.nextTierPoints - summary.totalPoints).clamp(0, summary.nextTierPoints)} points needed',
                                style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: LinearProgressIndicator(
                              value: progressPercent,
                              backgroundColor: Colors.white.withOpacity(0.3),
                              valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                              minHeight: 8,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: Colors.white,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white70,
              tabs: const [
                Tab(text: 'Earn Points'),
                Tab(text: 'Redeem'),
              ],
            ),
          ),
          SliverFillRemaining(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildEarnTab(),
                _buildRedeemTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEarnTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('How to Earn Points', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildEarnMethod(Icons.star, 'Complete Transactions', 'Earn 1 point for every ₦100 spent', Colors.purple),
                const SizedBox(height: 12),
                _buildEarnMethod(Icons.card_giftcard, 'Pay Bills', 'Get 2% cashback in points', Colors.pink),
                const SizedBox(height: 12),
                _buildEarnMethod(Icons.trending_up, 'Save Regularly', 'Bonus points for 7-day saving streaks', Colors.green),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        const Text('Recent Points', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        if (_earnedRewards.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text('No rewards earned yet', style: TextStyle(color: Colors.grey)),
              ),
            ),
          )
        else
          Card(
            child: Column(
              children: _earnedRewards.map((reward) {
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.grey.shade100,
                    child: Icon(_categoryIcon(reward.category), color: Colors.purple, size: 20),
                  ),
                  title: Text(reward.title),
                  subtitle: Text(_formatDate(reward.date)),
                  trailing: Text(
                    '+${reward.points}',
                    style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                );
              }).toList(),
            ),
          ),
      ],
    );
  }

  Widget _buildRedeemTab() {
    if (_redeemOptions.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('No redemption options available', style: TextStyle(color: Colors.grey)),
        ),
      );
    }

    final userPoints = _summary?.totalPoints ?? 0;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Redeem Your Points', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        ..._redeemOptions.map((option) {
          final canRedeem = userPoints >= option.pointsRequired && option.isAvailable;
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Opacity(
              opacity: canRedeem ? 1.0 : 0.6,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (option.imageUrl != null)
                          Text(option.imageUrl!, style: const TextStyle(fontSize: 40))
                        else
                          const Icon(Icons.card_giftcard, size: 40, color: Colors.purple),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      option.title,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.purple.shade50,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      option.category,
                                      style: TextStyle(color: Colors.purple.shade700, fontSize: 11),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                option.description,
                                style: const TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.star, color: Colors.amber, size: 18),
                            const SizedBox(width: 4),
                            Text(
                              '${option.pointsRequired} points',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        ElevatedButton(
                          onPressed: canRedeem ? () => _handleRedeem(option) : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.purple,
                            disabledBackgroundColor: Colors.grey,
                          ),
                          child: const Text('Redeem'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildEarnMethod(IconData icon, String title, String subtitle, Color color) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
              Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 13)),
            ],
          ),
        ),
      ],
    );
  }
}

// Keep old class name for backward compatibility
class CreditsRewardsScreen extends RewardsScreen {
  const CreditsRewardsScreen({super.key});
}
