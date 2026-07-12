import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../services/loan_service.dart';
import '../../../services/api_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../../providers/tenant_provider.dart';

class ActiveLoansScreen extends StatefulWidget {
  const ActiveLoansScreen({super.key});

  @override
  State<ActiveLoansScreen> createState() => _ActiveLoansScreenState();
}

class _ActiveLoansScreenState extends State<ActiveLoansScreen> {
  // ignore: unused_field
  final LoanService _loanService = LoanService(ApiService());
  List<Map<String, dynamic>> _activeLoans = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadActiveLoans();
  }

  Future<void> _loadActiveLoans() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Matches web app: loanService.getAllLoans() returns array directly
      final loans = await _loanService.getAllLoans();
      
      setState(() {
        _activeLoans = loans;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _handleRefresh() async {
    await _loadActiveLoans();
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return Colors.green;
      case 'pending approval':
        return Colors.orange;
      case 'disbursed':
        return Colors.blue;
      case 'rejected':
        return Colors.red;
      case 'closed':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.activeLoans, style: const TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Theme.of(context).colorScheme.primary.withOpacity(0.05),
                Theme.of(context).colorScheme.primary.withOpacity(0.02),
              ],
            ),
          ),
        ),
        actions: [
          Consumer<TenantProvider>(
            builder: (context, tenantProvider, _) {
              return Container(
                margin: const EdgeInsets.only(right: 12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      tenantProvider.primaryColor.withOpacity(0.1),
                      tenantProvider.primaryColor.withOpacity(0.05),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: tenantProvider.primaryColor.withOpacity(0.2),
                    width: 1,
                  ),
                ),
                child: IconButton(
                  icon: const Icon(Icons.add_rounded),
                  onPressed: () {
                    Navigator.pushNamed(context, '/loan-Application');
                  },
                  tooltip: 'Apply for New Loan',
                ),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Theme.of(context).colorScheme.error.withOpacity(0.1),
                                Theme.of(context).colorScheme.error.withOpacity(0.05),
                              ],
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.error_outline_rounded,
                            size: 64,
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'Error loading loans',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 32),
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: AppTheme.getTextSecondary(context)),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 32),
                        Consumer<TenantProvider>(
                          builder: (context, tenantProvider, _) {
                            return Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    tenantProvider.primaryColor,
                                    tenantProvider.primaryColor.withOpacity(0.85),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: [
                                  BoxShadow(
                                    color: tenantProvider.primaryColor.withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: ElevatedButton.icon(
                                onPressed: _loadActiveLoans,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.transparent,
                                  shadowColor: Colors.transparent,
                                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                ),
                                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                                label: const Text(
                                  'Retry',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  )
                : _activeLoans.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(28),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Theme.of(context).colorScheme.primary.withOpacity(0.1),
                                    Theme.of(context).colorScheme.primary.withOpacity(0.05),
                                  ],
                                ),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.account_balance_rounded,
                                size: 80,
                                color: Theme.of(context).colorScheme.primary.withOpacity(0.6),
                              ),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              'No Active Loans',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.getTextPrimary(context),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 48),
                              child: Text(
                                'Apply for a loan to get started',
                                style: TextStyle(
                                  color: AppTheme.getTextSecondary(context),
                                  fontSize: 14,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                            const SizedBox(height: 32),
                            Consumer<TenantProvider>(
                              builder: (context, tenantProvider, _) {
                                return Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        tenantProvider.primaryColor,
                                        tenantProvider.primaryColor.withOpacity(0.85),
                                      ],
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                    boxShadow: [
                                      BoxShadow(
                                        color: tenantProvider.primaryColor.withOpacity(0.3),
                                        blurRadius: 10,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: ElevatedButton.icon(
                                    onPressed: () {
                                      Navigator.pushNamed(context, '/loan-Application');
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.transparent,
                                      shadowColor: Colors.transparent,
                                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                    ),
                                    icon: const Icon(Icons.add_rounded, color: Colors.white),
                                    label: const Text(
                                      'Apply for Loan',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(20),
                        itemCount: _activeLoans.length,
                        itemBuilder: (context, index) {
                          final loan = _activeLoans[index];
                          return _buildLoanCard(loan);
                        },
                      ),
      ),
    );
  }

  Widget _buildLoanCard(Map<String, dynamic> loan) {
    final bool isActive = loan['status']?.toLowerCase() == 'active';
    final statusColor = _getStatusColor(loan['status'] ?? 'pending');
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.getCardBackground(context),
            AppTheme.getCardBackground(context).withOpacity(0.95),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: statusColor.withOpacity(0.15),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: statusColor.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -4,
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
  print("Selected loan: $loan");

  Navigator.pushNamed(
    context,
    '/loan-details',
    arguments: {
      'loanId': (
        loan['loan_application_id'] ??
        loan['loan_id'] ??
        loan['id'] ??
        loan['loan_number']
      ).toString(),
    },
  );
},
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(18),
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
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      statusColor.withOpacity(0.25),
                                      statusColor.withOpacity(0.12),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: statusColor.withOpacity(0.3),
                                      blurRadius: 12,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  Icons.account_balance_wallet_rounded,
                                  color: statusColor,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      loan['loan_application_id'] ?? loan['loan_number'] ?? 'N/A',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: AppTheme.getTextPrimary(context),
                                        letterSpacing: 0.3,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: AppTheme.getTextSecondary(context).withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        '${loan['requested_term'] ?? loan['duration_months'] ?? 'N/A'} months @ ${loan['LoanInterestRatePercent'] ?? loan['interest_rate'] ?? 'N/A'}% p.a.',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: AppTheme.getTextSecondary(context),
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            statusColor.withOpacity(0.15),
                            statusColor.withOpacity(0.08),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: statusColor.withOpacity(0.3),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        loan['status'] ?? 'N/A',
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Theme.of(context).colorScheme.primary.withOpacity(0.05),
                        Theme.of(context).colorScheme.primary.withOpacity(0.02),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                      width: 1,
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Loan Amount',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextSecondary(context),
                            ),
                          ),
                          Text(
                            '₦${(loan['loan_amount'] as num).toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.getTextPrimary(context),
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                      if (isActive) ...[
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Outstanding',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.getTextSecondary(context),
                              ),
                            ),
                            Text(
                              '₦${(loan['outstanding_balance'] as num).toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Colors.orange,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Monthly Payment',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.getTextSecondary(context),
                              ),
                            ),
                            Text(
                              '₦${(loan['monthly_payment'] as num).toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.primaryDark,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    // Container(
                    //   padding: const EdgeInsets.all(6),
                    //   decoration: BoxDecoration(
                    //     color: AppTheme.getTextSecondary(context).withOpacity(0.1),
                    //     borderRadius: BorderRadius.circular(6),
                    //   ),
                    //   // child: Icon(
                    //   //   Icons.calendar_today_rounded,
                    //   //   size: 14,
                    //   //   color: AppTheme.getTextSecondary(context),
                    //   // ),
                    // ),
                    
                    const SizedBox(width: 8),
                    // Text(
                    //   'Created: ${loan['created_at']}',
                    //   style: TextStyle(
                    //     fontSize: 12,
                    //     fontWeight: FontWeight.w500,
                    //     color: AppTheme.getTextSecondary(context),
                    //   ),
                    // ),
                    
                    if (isActive && loan['next_payment_date'] != null) ...[
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Icon(
                          Icons.payment_rounded,
                          size: 14,
                          color: Colors.orange,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Next: ${loan['next_payment_date']}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.orange,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
