import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../providers/trade_finance_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../models/trade_finance.dart';
import '../../../config/app_theme.dart';
import 'lc_apply_screen.dart';
import 'lc_details_screen.dart';

class LCListScreen extends StatelessWidget {
  const LCListScreen({super.key});

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'issued':
        return Colors.blue;
      case 'confirmed':
        return Colors.green;
      case 'draft':
        return Colors.orange;
      case 'amended':
        return Colors.purple;
      case 'expired':
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _formatAmount(double amount, String currency) {
    final format = NumberFormat('#,##0.00');
    return '$currency ${format.format(amount)}';
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => TradeFinanceProvider()..fetchLCs(),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Letters of Credit',
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
                    tooltip: 'Apply for LC',
                    onPressed: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const LCApplyScreen()),
                      );
                      if (result == true && context.mounted) {
                        Provider.of<TradeFinanceProvider>(context, listen: false)
                            .fetchLCs();
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
            if (provider.lcStatus == TradeFinanceStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.lcStatus == TradeFinanceStatus.error) {
              return _ErrorView(
                message: provider.lcError ?? 'An error occurred',
                onRetry: provider.fetchLCs,
              );
            }

            if (provider.lcs.isEmpty) {
              return _EmptyView(
                onApply: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LCApplyScreen()),
                  );
                  if (result == true && context.mounted) {
                    provider.fetchLCs();
                  }
                },
              );
            }

            return RefreshIndicator(
              onRefresh: () => provider.fetchLCs(),
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: provider.lcs.length,
                itemBuilder: (context, index) {
                  final lc = provider.lcs[index];
                  return _LCCard(
                    lc: lc,
                    statusColor: _statusColor(lc.status),
                    formattedAmount: _formatAmount(lc.amount, lc.currency),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => LCDetailsScreen(lc: lc)),
                    ),
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

class _LCCard extends StatelessWidget {
  final LetterOfCredit lc;
  final Color statusColor;
  final String formattedAmount;
  final VoidCallback onTap;

  const _LCCard({
    required this.lc,
    required this.statusColor,
    required this.formattedAmount,
    required this.onTap,
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
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
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFF059669).withOpacity(0.2),
                            const Color(0xFF059669).withOpacity(0.1),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.article_rounded,
                          color: Color(0xFF059669), size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lc.beneficiaryName.isNotEmpty
                                ? lc.beneficiaryName
                                : 'Letter of Credit',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.getTextPrimary(context),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            lc.lcRef.isNotEmpty ? lc.lcRef : 'LC #${lc.id.length > 8 ? lc.id.substring(lc.id.length - 8) : lc.id}',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppTheme.getTextSecondary(context),
                              fontFamily: 'monospace',
                            ),
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
                        border:
                            Border.all(color: statusColor.withOpacity(0.3)),
                      ),
                      child: Text(
                        lc.status.toUpperCase(),
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          letterSpacing: 0.5,
                        ),
                      ),
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
                      _InfoCell(label: 'Amount', value: formattedAmount),
                      _InfoCell(label: 'Type', value: lc.type),
                      if (lc.expiryDate.isNotEmpty)
                        _InfoCell(
                          label: 'Expiry',
                          value: lc.expiryDate.length > 10
                              ? lc.expiryDate.substring(0, 10)
                              : lc.expiryDate,
                        ),
                    ],
                  ),
                ),
                if (lc.swiftRef.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(Icons.swap_horiz_rounded,
                          size: 14,
                          color: AppTheme.getTextSecondary(context)),
                      const SizedBox(width: 5),
                      Text(
                        'SWIFT: ${lc.swiftRef}',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.getTextSecondary(context),
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoCell extends StatelessWidget {
  final String label;
  final String value;

  const _InfoCell({required this.label, required this.value});

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

class _EmptyView extends StatelessWidget {
  final VoidCallback onApply;

  const _EmptyView({required this.onApply});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: const Color(0xFF059669).withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.article_rounded,
                size: 72, color: Color(0xFF059669)),
          ),
          const SizedBox(height: 24),
          Text(
            'No Letters of Credit',
            style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.getTextPrimary(context)),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 48),
            child: Text(
              'Issue your first letter of credit to start trading internationally',
              style: TextStyle(
                  color: AppTheme.getTextSecondary(context), fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: onApply,
            icon: const Icon(Icons.add_rounded, color: Colors.white),
            label: const Text('Apply for LC',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              padding:
                  const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline_rounded,
              size: 64, color: Theme.of(context).colorScheme.error),
          const SizedBox(height: 16),
          Text('Error loading data',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.getTextPrimary(context))),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(message,
                style:
                    TextStyle(color: AppTheme.getTextSecondary(context)),
                textAlign: TextAlign.center),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            label: const Text('Retry',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }
}
