import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../models/mortgage.dart';
import '../../../services/mortgage_service.dart';
import '../../../l10n/app_localizations.dart';

class MortgageDetailsScreen extends StatefulWidget {
  final Mortgage mortgage;

  const MortgageDetailsScreen({super.key, required this.mortgage});

  @override
  State<MortgageDetailsScreen> createState() => _MortgageDetailsScreenState();
}

class _MortgageDetailsScreenState extends State<MortgageDetailsScreen> {
  List<dynamic> _schedule = [];
  bool _loadingSchedule = false;

  @override
  void initState() {
    super.initState();
    _loadRepaymentSchedule();
  }

  Future<void> _loadRepaymentSchedule() async {
    setState(() => _loadingSchedule = true);
    try {
      final schedule = await MortgageService.instance.getRepaymentSchedule(widget.mortgage.id);
      if (mounted) setState(() => _schedule = schedule);
    } catch (_) {
      // Schedule may not be available for pending applications
    } finally {
      if (mounted) setState(() => _loadingSchedule = false);
    }
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
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final mortgage = widget.mortgage;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.mortgageDetails),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status + Amount header
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: AppTheme.getBorderColor(context)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Status', style: TextStyle(fontSize: 14, color: AppTheme.getTextSecondary(context))),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: _getStatusColor(mortgage.status).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            mortgage.status,
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _getStatusColor(mortgage.status)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Text(
                      currencyFormat.format(mortgage.loanAmount),
                      style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                    ),
                    const SizedBox(height: 8),
                    Text('Loan Amount', style: TextStyle(fontSize: 14, color: AppTheme.getTextSecondary(context))),
                    if (mortgage.applicationNumber.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text('Ref: ${mortgage.applicationNumber}', style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context))),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Applicant Details
            if (mortgage.applicantName.isNotEmpty || mortgage.applicantEmail.isNotEmpty) ...[
              _sectionTitle(context, 'Applicant Details'),
              const SizedBox(height: 12),
              if (mortgage.applicantName.isNotEmpty) _buildInfoCard(context, icon: Icons.person_outlined, label: 'Name', value: mortgage.applicantName),
              if (mortgage.applicantEmail.isNotEmpty) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.email_outlined, label: 'Email', value: mortgage.applicantEmail)],
              if (mortgage.applicantPhone.isNotEmpty) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.phone_outlined, label: 'Phone', value: mortgage.applicantPhone)],
              if (mortgage.employmentStatus.isNotEmpty) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.work_outlined, label: 'Employment', value: mortgage.employmentStatus)],
              if (mortgage.monthlyIncome > 0) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.payments_outlined, label: 'Monthly Income', value: currencyFormat.format(mortgage.monthlyIncome))],
              const SizedBox(height: 24),
            ],

            // Property Details
            _sectionTitle(context, 'Property Details'),
            const SizedBox(height: 12),
            _buildInfoCard(context, icon: Icons.location_on_outlined, label: l10n.propertyAddress, value: mortgage.propertyAddress),
            if (mortgage.propertyCity.isNotEmpty) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.location_city_outlined, label: 'City / State', value: '${mortgage.propertyCity}, ${mortgage.propertyState}')],
            if (mortgage.propertyLga.isNotEmpty) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.map_outlined, label: 'LGA', value: mortgage.propertyLga)],
            const SizedBox(height: 8),
            _buildInfoCard(context, icon: Icons.home_outlined, label: l10n.propertyType, value: mortgage.propertyType.isNotEmpty ? mortgage.propertyType : 'N/A'),
            if (mortgage.propertyValue > 0) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.account_balance_outlined, label: l10n.propertyValue, value: currencyFormat.format(mortgage.propertyValue))],
            if (mortgage.titleType.isNotEmpty) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.description_outlined, label: 'Title Type', value: '${mortgage.titleType} — ${mortgage.titleNumber}')],
            const SizedBox(height: 24),

            // Loan Details
            _sectionTitle(context, 'Loan Details'),
            const SizedBox(height: 12),
            _buildInfoCard(context, icon: Icons.category_outlined, label: 'Product', value: mortgage.productType.isNotEmpty ? mortgage.productType : 'N/A'),
            const SizedBox(height: 8),
            _buildInfoCard(context, icon: Icons.account_balance_wallet_outlined, label: l10n.downPayment, value: currencyFormat.format(mortgage.downPayment)),
            const SizedBox(height: 8),
            _buildInfoCard(context, icon: Icons.calendar_today_outlined, label: l10n.loanTerm, value: '${mortgage.loanTermMonths} months (${mortgage.loanTerm} years)'),
            const SizedBox(height: 8),
            _buildInfoCard(context, icon: Icons.percent_outlined, label: l10n.interestRate, value: '${mortgage.interestRate}% — ${mortgage.interestType.isNotEmpty ? mortgage.interestType : 'N/A'}'),
            if (mortgage.underwritingScore > 0) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.score_outlined, label: 'Underwriting Score', value: mortgage.underwritingScore.toStringAsFixed(1))],
            const SizedBox(height: 24),

            // Monthly payment card
            Card(
              elevation: 0,
              color: AppTheme.successColor.withOpacity(0.1),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.monthlyPayment, style: TextStyle(fontSize: 14, color: AppTheme.getTextSecondary(context))),
                        const SizedBox(height: 8),
                        Text(currencyFormat.format(mortgage.monthlyPayment), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.successColor)),
                        const SizedBox(height: 4),
                        Text('Total: ${currencyFormat.format(mortgage.totalPayment)}', style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context))),
                      ],
                    ),
                    Icon(Icons.payments_outlined, size: 40, color: AppTheme.successColor.withOpacity(0.5)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Dates
            _sectionTitle(context, 'Dates'),
            const SizedBox(height: 12),
            _buildInfoCard(context, icon: Icons.event_outlined, label: 'Application Date', value: DateFormat('MMM dd, yyyy').format(mortgage.applicationDate)),
            if (mortgage.approvalDate != null) ...[const SizedBox(height: 8), _buildInfoCard(context, icon: Icons.check_circle_outline, label: 'Approval Date', value: DateFormat('MMM dd, yyyy').format(mortgage.approvalDate!))],
            const SizedBox(height: 24),

            // Repayment Schedule
            _sectionTitle(context, 'Repayment Schedule'),
            const SizedBox(height: 12),
            if (_loadingSchedule)
              const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
            else if (_schedule.isEmpty)
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: AppTheme.getBorderColor(context))),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text('Schedule available after approval', style: TextStyle(color: AppTheme.getTextSecondary(context))),
                ),
              )
            else
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: AppTheme.getBorderColor(context))),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: const [
                          Expanded(flex: 1, child: Text('#', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                          Expanded(flex: 3, child: Text('Due Date', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                          Expanded(flex: 3, child: Text('Principal', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                          Expanded(flex: 3, child: Text('Interest', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                          Expanded(flex: 2, child: Text('Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    ..._schedule.take(12).map((entry) {
                      final e = entry as Map<String, dynamic>;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        child: Row(
                          children: [
                            Expanded(flex: 1, child: Text((e['installment_number'] ?? e['period'] ?? '-').toString(), style: const TextStyle(fontSize: 12))),
                            Expanded(flex: 3, child: Text((e['due_date'] ?? '-').toString().substring(0, 10), style: const TextStyle(fontSize: 12))),
                            Expanded(flex: 3, child: Text(currencyFormat.format(e['principal_amount'] ?? e['principal'] ?? 0), style: const TextStyle(fontSize: 12))),
                            Expanded(flex: 3, child: Text(currencyFormat.format(e['interest_amount'] ?? e['interest'] ?? 0), style: const TextStyle(fontSize: 12))),
                            Expanded(flex: 2, child: Text((e['status'] ?? '-').toString(), style: const TextStyle(fontSize: 11))),
                          ],
                        ),
                      );
                    }),
                    if (_schedule.length > 12)
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text('+ ${_schedule.length - 12} more instalments', style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context))),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Text(
      title,
      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context)),
    );
  }

  Widget _buildInfoCard(BuildContext context, {required IconData icon, required String label, required String value}) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: AppTheme.getBorderColor(context))),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, color: AppTheme.primaryColor, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(fontSize: 12, color: AppTheme.getTextSecondary(context))),
                  const SizedBox(height: 4),
                  Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: AppTheme.getTextPrimary(context))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
