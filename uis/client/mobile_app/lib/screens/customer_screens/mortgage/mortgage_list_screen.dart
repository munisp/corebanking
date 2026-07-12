import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../models/mortgage.dart';
import '../../../l10n/app_localizations.dart';
import 'mortgage_details_screen.dart';
import 'mortgage_application_screen.dart';
import 'mortgage_calculator_screen.dart';
import '../../../services/mortgage_service.dart';

class MortgageListScreen extends StatefulWidget {
  const MortgageListScreen({super.key});

  @override
  State<MortgageListScreen> createState() => _MortgageListScreenState();
}

class _MortgageListScreenState extends State<MortgageListScreen> {
  bool _isLoading = false;
  List<Mortgage> _mortgages = [];

  @override
  void initState() {
    super.initState();
    _loadMortgages();
  }

  Future<void> _loadMortgages() async {
    setState(() => _isLoading = true);
    try {
      _mortgages = await MortgageService.instance.getMortgages();
    } catch (e) {
      // Optionally handle error
      _mortgages = [];
    }
    setState(() => _isLoading = false);
  }

  Future<void> _handleRefresh() async {
    await _loadMortgages();
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return AppTheme.successColor;
      case 'pending':
        return AppTheme.warningColor;
      case 'approved':
        return Colors.blue;
      case 'rejected':
        return AppTheme.errorColor;
      case 'completed':
        return AppTheme.primaryColor;
      default:
        return Colors.grey;
    }
  }

  IconData _getPropertyIcon(String type) {
    switch (type.toLowerCase()) {
      case 'apartment':
        return Icons.apartment_outlined;
      case 'house':
        return Icons.house_outlined;
      case 'commercial':
        return Icons.business_outlined;
      case 'land':
        return Icons.landscape_outlined;
      default:
        return Icons.home_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.mortgageLoans),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.calculate_outlined),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const MortgageCalculatorScreen(),
                ),
              );
            },
            tooltip: l10n.mortgageCalculator,
          ),
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const MortgageApplicationScreen(),
                ),
              ).then((_) => _loadMortgages());
            },
            tooltip: l10n.applyForMortgage,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _mortgages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.home_outlined,
                          size: 64,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No Mortgage Loans',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Apply for a mortgage to own your dream home',
                          style: TextStyle(
                            color: AppTheme.getTextSecondary(context),
                          ),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const MortgageApplicationScreen(),
                              ),
                            ).then((_) => _loadMortgages());
                          },
                          icon: const Icon(Icons.add),
                          label: Text(l10n.applyForMortgage),
                        ),
                        const SizedBox(height: 16),
                        TextButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const MortgageCalculatorScreen(),
                              ),
                            );
                          },
                          icon: const Icon(Icons.calculate_outlined),
                          label: Text(l10n.mortgageCalculator),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _mortgages.length,
                    itemBuilder: (context, index) {
                      final mortgage = _mortgages[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: AppTheme.getBorderColor(context),
                          ),
                        ),
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    MortgageDetailsScreen(mortgage: mortgage),
                              ),
                            ).then((_) => _loadMortgages());
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: AppTheme.primaryColor
                                            .withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(
                                        _getPropertyIcon(mortgage.propertyType),
                                        color: AppTheme.primaryColor,
                                        size: 24,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            mortgage.propertyAddress,
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w600,
                                              color: AppTheme.getTextPrimary(
                                                  context),
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            mortgage.propertyType,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.getTextSecondary(
                                                  context),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _getStatusColor(mortgage.status)
                                            .withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        mortgage.status,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: _getStatusColor(mortgage.status),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Loan Amount',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.getTextSecondary(
                                                  context),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            currencyFormat
                                                .format(mortgage.loanAmount),
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: AppTheme.primaryColor,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                            'Monthly Payment',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.getTextSecondary(
                                                  context),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            currencyFormat
                                                .format(mortgage.monthlyPayment),
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: AppTheme.getTextPrimary(
                                                  context),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.calendar_today_outlined,
                                      size: 14,
                                      color: AppTheme.getTextSecondary(context),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${mortgage.loanTerm} years term • ${mortgage.interestRate}% interest',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: AppTheme.getTextSecondary(context),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
