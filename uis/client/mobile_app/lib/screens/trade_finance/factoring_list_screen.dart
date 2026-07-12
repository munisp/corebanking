import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../providers/trade_finance_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../models/trade_finance.dart';
import '../../../config/app_theme.dart';
import 'factoring_apply_screen.dart';

class FactoringListScreen extends StatelessWidget {
  const FactoringListScreen({super.key});

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      case 'disbursed':
        return Colors.blue;
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
      create: (_) => TradeFinanceProvider()..fetchFactoringApps(),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Export Factoring',
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
                    tooltip: 'Apply for Factoring',
                    onPressed: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const FactoringApplyScreen()),
                      );
                      if (result == true && context.mounted) {
                        Provider.of<TradeFinanceProvider>(context,
                                listen: false)
                            .fetchFactoringApps();
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
            if (provider.factoringStatus == TradeFinanceStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.factoringStatus == TradeFinanceStatus.error) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.error_outline_rounded,
                        size: 56,
                        color: Theme.of(context).colorScheme.error),
                    const SizedBox(height: 16),
                    Text(
                        provider.factoringError ??
                            'Failed to load applications',
                        style: TextStyle(
                            color: AppTheme.getTextSecondary(context))),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      onPressed: provider.fetchFactoringApps,
                      icon: const Icon(Icons.refresh_rounded,
                          color: Colors.white),
                      label: const Text('Retry',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            }

            if (provider.factoringApps.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: const Color(0xFF7C3AED).withOpacity(0.08),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.receipt_long_rounded,
                          size: 72, color: Color(0xFF7C3AED)),
                    ),
                    const SizedBox(height: 24),
                    Text('No Factoring Applications',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context))),
                    const SizedBox(height: 10),
                    Padding(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 48),
                      child: Text(
                          'Convert your export invoices into immediate cash',
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
                                  const FactoringApplyScreen()),
                        );
                        if (result == true && context.mounted) {
                          provider.fetchFactoringApps();
                        }
                      },
                      icon: const Icon(Icons.add_rounded, color: Colors.white),
                      label: const Text('Apply for Factoring',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7C3AED),
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
              onRefresh: () => provider.fetchFactoringApps(),
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: provider.factoringApps.length,
                itemBuilder: (context, index) {
                  final app = provider.factoringApps[index];
                  final color = _statusColor(app.status);
                  return _FactoringCard(
                    app: app,
                    statusColor: color,
                    formattedInvoice:
                        _formatAmount(app.invoiceTotal, app.currency),
                    formattedFactoring:
                        _formatAmount(app.factoringAmount, app.currency),
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

class _FactoringCard extends StatelessWidget {
  final FactoringApplication app;
  final Color statusColor;
  final String formattedInvoice;
  final String formattedFactoring;

  const _FactoringCard({
    required this.app,
    required this.statusColor,
    required this.formattedInvoice,
    required this.formattedFactoring,
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
                    color: const Color(0xFF7C3AED).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.receipt_long_rounded,
                      color: Color(0xFF7C3AED), size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        app.debtorName.isNotEmpty
                            ? app.debtorName
                            : 'Factoring Application',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.getTextPrimary(context)),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        app.applicationRef.isNotEmpty
                            ? app.applicationRef
                            : 'Ref #${app.id.length > 8 ? app.id.substring(app.id.length - 8) : app.id}',
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
                    border:
                        Border.all(color: statusColor.withOpacity(0.3)),
                  ),
                  child: Text(app.status.toUpperCase(),
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
                  _Cell(label: 'Invoice Total', value: formattedInvoice),
                  _Cell(label: 'Factoring Amount', value: formattedFactoring),
                  if (app.discountRate > 0)
                    _Cell(
                        label: 'Discount Rate',
                        value: '${app.discountRate.toStringAsFixed(2)}%'),
                ],
              ),
            ),
            if (app.invoiceCount > 0) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.description_outlined,
                      size: 14,
                      color: AppTheme.getTextSecondary(context)),
                  const SizedBox(width: 5),
                  Text('${app.invoiceCount} invoice${app.invoiceCount > 1 ? 's' : ''}',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.getTextSecondary(context))),
                ],
              ),
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
