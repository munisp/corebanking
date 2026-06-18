import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../providers/trade_finance_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../models/trade_finance.dart';
import '../../../config/app_theme.dart';
import 'bank_guarantee_apply_screen.dart';

class BankGuaranteeListScreen extends StatelessWidget {
  const BankGuaranteeListScreen({super.key});

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'issued':
        return Colors.blue;
      case 'extended':
        return Colors.purple;
      case 'draft':
        return Colors.orange;
      case 'cancelled':
      case 'expired':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _formatAmount(double amount, String currency) {
    return '$currency ${NumberFormat('#,##0.00').format(amount)}';
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => TradeFinanceProvider()..fetchGuarantees(),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Bank Guarantees',
              style: TextStyle(fontWeight: FontWeight.bold)),
          elevation: 0,
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
                        color: tenantProvider.primaryColor.withOpacity(0.2)),
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.add_rounded),
                    tooltip: 'Request Guarantee',
                    onPressed: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const BankGuaranteeApplyScreen()),
                      );
                      if (result == true && context.mounted) {
                        Provider.of<TradeFinanceProvider>(context,
                                listen: false)
                            .fetchGuarantees();
                      }
                    },
                  ),
                );
              },
            ),
          ],
        ),
        body: Consumer<TradeFinanceProvider>(
          builder: (context, provider, _) {
            if (provider.bgStatus == TradeFinanceStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.bgStatus == TradeFinanceStatus.error) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.error_outline_rounded,
                        size: 56,
                        color: Theme.of(context).colorScheme.error),
                    const SizedBox(height: 16),
                    Text(provider.bgError ?? 'Failed to load guarantees',
                        style: TextStyle(
                            color: AppTheme.getTextSecondary(context))),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      onPressed: provider.fetchGuarantees,
                      icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                      label: const Text('Retry',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            }

            if (provider.guarantees.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0369A1).withOpacity(0.08),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.verified_rounded,
                          size: 72, color: Color(0xFF0369A1)),
                    ),
                    const SizedBox(height: 24),
                    Text('No Bank Guarantees',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context))),
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 48),
                      child: Text(
                          'Request a guarantee to secure your trade transactions',
                          style: TextStyle(
                              color: AppTheme.getTextSecondary(context),
                              fontSize: 14),
                          textAlign: TextAlign.center),
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton.icon(
                      onPressed: () async {
                        final result = await Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) =>
                                  const BankGuaranteeApplyScreen()),
                        );
                        if (result == true && context.mounted) {
                          provider.fetchGuarantees();
                        }
                      },
                      icon: const Icon(Icons.add_rounded, color: Colors.white),
                      label: const Text('Request Guarantee',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0369A1),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 32, vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: () => provider.fetchGuarantees(),
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: provider.guarantees.length,
                itemBuilder: (context, index) {
                  final bg = provider.guarantees[index];
                  final color = _statusColor(bg.status);
                  return _BankGuaranteeCard(
                    bg: bg,
                    statusColor: color,
                    formattedAmount: _formatAmount(bg.amount, bg.currency),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _BankGuaranteeCard extends StatelessWidget {
  final BankGuarantee bg;
  final Color statusColor;
  final String formattedAmount;

  const _BankGuaranteeCard({
    required this.bg,
    required this.statusColor,
    required this.formattedAmount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: statusColor.withOpacity(0.15), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: statusColor.withOpacity(0.07),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -4,
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0369A1).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.verified_rounded,
                      color: Color(0xFF0369A1), size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        bg.beneficiaryName.isNotEmpty
                            ? bg.beneficiaryName
                            : 'Bank Guarantee',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.getTextPrimary(context)),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        bg.guaranteeRef.isNotEmpty
                            ? bg.guaranteeRef
                            : 'BG #${bg.id.length > 8 ? bg.id.substring(bg.id.length - 8) : bg.id}',
                        style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.getTextSecondary(context),
                            fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withOpacity(0.3)),
                  ),
                  child: Text(bg.status.toUpperCase(),
                      style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          letterSpacing: 0.5)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.04),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: Theme.of(context)
                        .colorScheme
                        .primary
                        .withOpacity(0.08)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _Cell(label: 'Amount', value: formattedAmount),
                  _Cell(
                      label: 'Type',
                      value: bg.type
                          .replaceAll('_', ' ')
                          .split(' ')
                          .map((w) =>
                              w.isNotEmpty
                                  ? w[0].toUpperCase() + w.substring(1)
                                  : w)
                          .join(' ')),
                  if (bg.expiryDate.isNotEmpty)
                    _Cell(
                        label: 'Expiry',
                        value: bg.expiryDate.length > 10
                            ? bg.expiryDate.substring(0, 10)
                            : bg.expiryDate),
                ],
              ),
            ),
            if (bg.purpose.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(bg.purpose,
                  style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.getTextSecondary(context)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
          ],
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  final String label;
  final String value;

  const _Cell({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 10, color: AppTheme.getTextSecondary(context))),
        const SizedBox(height: 2),
        Text(value,
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppTheme.getTextPrimary(context))),
      ],
    );
  }
}
