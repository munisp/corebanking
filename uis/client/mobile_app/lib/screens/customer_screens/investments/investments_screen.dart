import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import '../../../utils/theme_extensions.dart';

class InvestmentsScreen extends StatefulWidget {
  const InvestmentsScreen({super.key});

  @override
  State<InvestmentsScreen> createState() => _InvestmentsScreenState();
}

class _InvestmentsScreenState extends State<InvestmentsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final Map<String, dynamic> _portfolio = {
    'totalValue': 2500000.00,
    'totalGain': 250000.00,
    'gainPercentage': 11.11,
  };

  final List<Map<String, dynamic>> _investments = [
    {
      'id': '1',
      'name': 'Treasury Bills',
      'type': 'Fixed Income',
      'amount': 1000000.00,
      'currentValue': 1080000.00,
      'returnRate': 8.0,
      'maturityDate': '2025-03-15',
      'status': 'Active',
      'risk': 'Low',
    },
    {
      'id': '2',
      'name': 'Mutual Fund - Equity',
      'type': 'Mutual Fund',
      'amount': 500000.00,
      'currentValue': 565000.00,
      'returnRate': 13.0,
      'maturityDate': null,
      'status': 'Active',
      'risk': 'Medium',
    },
    {
      'id': '3',
      'name': 'Real Estate Fund',
      'type': 'Real Estate',
      'amount': 750000.00,
      'currentValue': 855000.00,
      'returnRate': 14.0,
      'maturityDate': '2026-12-31',
      'status': 'Active',
      'risk': 'Medium',
    },
  ];

  final List<Map<String, dynamic>> _availableProducts = [
    {
      'name': 'Treasury Bills',
      'type': 'Fixed Income',
      'minInvestment': 100000.00,
      'returnRate': 8.0,
      'tenure': '91-365 days',
      'risk': 'Low',
    },
    {
      'name': 'Commercial Papers',
      'type': 'Fixed Income',
      'minInvestment': 500000.00,
      'returnRate': 10.5,
      'tenure': '90-270 days',
      'risk': 'Low-Medium',
    },
    {
      'name': 'Equity Mutual Fund',
      'type': 'Mutual Fund',
      'minInvestment': 50000.00,
      'returnRate': 12.0,
      'tenure': 'Flexible',
      'risk': 'Medium',
    },
    {
      'name': 'Money Market Fund',
      'type': 'Mutual Fund',
      'minInvestment': 25000.00,
      'returnRate': 7.5,
      'tenure': 'Flexible',
      'risk': 'Low',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _handleRefresh() async {
    await Future.delayed(const Duration(seconds: 1));
  }

  Color _getRiskColor(String risk, BuildContext context) {
    final theme = Theme.of(context);
    switch (risk.toLowerCase()) {
      case 'low':
        return theme.successColor;
      case 'low-medium':
        return Color.lerp(theme.successColor, theme.warningColor, 0.5)!;
      case 'medium':
        return theme.warningColor;
      case 'high':
        return theme.colorScheme.error;
      default:
        return theme.colorScheme.onSurface.withOpacity(0.5);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    if (!tenantProvider.isFeatureEnabled('investment')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Investments')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.trending_up, size: 64, color: AppTheme.getTextSecondary(context)),
                const SizedBox(height: 16),
                Text('Investments Not Available', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context))),
                const SizedBox(height: 8),
                Text('The investment feature is not enabled for your account. Contact support to enable this feature.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.getTextSecondary(context))),
              ],
            ),
          ),
        ),
      );
    }

    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Investments'),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'My Portfolio'),
            Tab(text: 'Products'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // My Portfolio Tab
          RefreshIndicator(
            onRefresh: _handleRefresh,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Portfolio Summary Card
                Card(
                  elevation: 4,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppTheme.primaryColor, AppTheme.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Total Portfolio Value',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          currencyFormat.format(_portfolio['totalValue']),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Icon(
                              _portfolio['gainPercentage'] >= 0 ? Icons.arrow_upward : Icons.arrow_downward,
                              color: Colors.white,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${currencyFormat.format(_portfolio['totalGain'])} (${_portfolio['gainPercentage']}%)',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Total Returns',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Active Investments
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Active Investments',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.add_circle_outline),
                      label: const Text('Invest'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                
                if (_investments.isEmpty)
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 32),
                        Icon(Icons.trending_up_outlined, size: 64, color: Colors.grey[400]),
                        const SizedBox(height: 16),
                        Text(
                          'No Active Investments',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[700],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Start investing to grow your wealth',
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  )
                else
                  ...(_investments.map((investment) => _buildInvestmentCard(investment, currencyFormat)).toList()),
              ],
            ),
          ),
          
          // Products Tab
          RefreshIndicator(
            onRefresh: _handleRefresh,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  color: AppTheme.primaryColor.withOpacity(0.1),
                  elevation: 0,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: AppTheme.primaryColor),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Choose from our range of investment products tailored to your goals',
                            style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ...(_availableProducts.map((product) => _buildProductCard(product, currencyFormat)).toList()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInvestmentCard(Map<String, dynamic> investment, NumberFormat currencyFormat) {
    final double gain = (investment['currentValue'] - investment['amount']) as double;
    final bool isPositive = gain >= 0;
    
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () {
          // Navigate to investment details
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          investment['name'],
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          investment['type'],
                          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getRiskColor(investment['risk'], context).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${investment['risk']} Risk',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _getRiskColor(investment['risk'], context),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Invested', style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                        Text(
                          currencyFormat.format(investment['amount']),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Current Value', style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                        Text(
                          currencyFormat.format(investment['currentValue']),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryDark,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Returns', style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                        Row(
                          children: [
                            Icon(
                              isPositive ? Icons.arrow_upward : Icons.arrow_downward,
                              size: 14,
                              color: isPositive ? Colors.green : Colors.red,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${currencyFormat.format(gain.abs())} (${investment['returnRate']}%)',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isPositive ? Colors.green : Colors.red,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (investment['maturityDate'] != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                    const SizedBox(width: 6),
                    Text(
                      'Matures: ${investment['maturityDate']}',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product, NumberFormat currencyFormat) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () {
          _showProductDetails(product);
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product['name'],
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          product['type'],
                          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${product['returnRate']}% p.a.',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.green,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildInfoChip('Min. Investment', currencyFormat.format(product['minInvestment'])),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildInfoChip('Tenure', product['tenure']),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getRiskColor(product['risk'], context).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.shield_outlined,
                          size: 14,
                          color: _getRiskColor(product['risk'], context),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${product['risk']} Risk',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _getRiskColor(product['risk'], context),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () {
                      _showProductDetails(product);
                    },
                    icon: const Icon(Icons.arrow_forward, size: 16),
                    label: const Text('Invest Now'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 11, color: Colors.grey[600]),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  void _showProductDetails(Map<String, dynamic> product) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(product['name']),
        content: const Text('Investment functionality coming soon!'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
