import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/bnpl_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../../config/app_theme.dart';
import 'bnpl_apply_screen.dart';
import 'bnpl_details_screen.dart';

class BNPLListScreen extends StatelessWidget {
  const BNPLListScreen({super.key});

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'declined':
        return Colors.red;
      case 'active':
        return Colors.blue;
      case 'completed':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

    return ChangeNotifierProvider(
      create: (_) => BNPLProvider()..fetchApplications(),
      child: Scaffold(
        appBar: AppBar(
          title: const Text(
            'Buy Now Pay Later',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
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
                    onPressed: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const BNPLApplyScreen()),
                      );
                      if (result == true && context.mounted) {
                        Provider.of<BNPLProvider>(context, listen: false).fetchApplications();
                      }
                    },
                    tooltip: 'Apply for BNPL',
                  ),
                );
              },
            ),
          ],
        ),
        body: Consumer<BNPLProvider>(
          builder: (context, provider, _) {
            if (provider.status == BNPLStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.status == BNPLStatus.error) {
              return Center(
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
                      child: Icon(Icons.error_outline_rounded, size: 64,
                          color: Theme.of(context).colorScheme.error),
                    ),
                    const SizedBox(height: 24),
                    Text('Error loading applications',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context))),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(provider.errorMessage ?? 'An error occurred',
                          style: TextStyle(color: AppTheme.getTextSecondary(context)),
                          textAlign: TextAlign.center),
                    ),
                    const SizedBox(height: 32),
                    Consumer<TenantProvider>(
                      builder: (context, tenantProvider, _) {
                        return ElevatedButton.icon(
                          onPressed: () => provider.fetchApplications(),
                          icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                          label: const Text('Retry',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: tenantProvider.primaryColor,
                            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              );
            }

            if (provider.applications.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFF7C3AED).withOpacity(0.1),
                            const Color(0xFF7C3AED).withOpacity(0.05),
                          ],
                        ),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.credit_card_rounded, size: 80,
                          color: Color(0xFF7C3AED)),
                    ),
                    const SizedBox(height: 24),
                    Text('No BNPL Applications',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context))),
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 48),
                      child: Text('Shop now and pay later in easy instalments',
                          style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 14),
                          textAlign: TextAlign.center),
                    ),
                    const SizedBox(height: 32),
                    Consumer<TenantProvider>(
                      builder: (context, tenantProvider, _) {
                        return ElevatedButton.icon(
                          onPressed: () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const BNPLApplyScreen()),
                            );
                            if (result == true && context.mounted) {
                              provider.fetchApplications();
                            }
                          },
                          icon: const Icon(Icons.add_rounded, color: Colors.white),
                          label: const Text('Apply for BNPL',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: tenantProvider.primaryColor,
                            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: () => provider.fetchApplications(),
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: provider.applications.length,
                itemBuilder: (context, index) {
                  final app = provider.applications[index];
                  final statusColor = _getStatusColor(app.status);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.getCardBackground(context),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: statusColor.withOpacity(0.15), width: 1.5),
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
                        borderRadius: BorderRadius.circular(18),
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => BNPLDetailsScreen(application: app),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [
                                          statusColor.withOpacity(0.25),
                                          statusColor.withOpacity(0.12),
                                        ],
                                      ),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Icon(Icons.credit_card_rounded,
                                        color: statusColor, size: 28),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          app.productDescription.isNotEmpty
                                              ? app.productDescription
                                              : 'BNPL Purchase',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w800,
                                            color: AppTheme.getTextPrimary(context),
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'ID: ${app.applicationId.length > 12 ? app.applicationId.substring(app.applicationId.length - 12) : app.applicationId}',
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
                                          color: statusColor.withOpacity(0.3), width: 1),
                                    ),
                                    child: Text(
                                      app.status.toUpperCase(),
                                      style: TextStyle(
                                          color: statusColor,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 11,
                                          letterSpacing: 0.5),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.primary.withOpacity(0.04),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: Theme.of(context).colorScheme.primary.withOpacity(0.1)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    _InfoCell(
                                      label: 'Purchase',
                                      value: currencyFormat.format(app.purchaseAmount),
                                    ),
                                    _InfoCell(
                                      label: 'Instalments',
                                      value: '${app.installmentCount}×',
                                    ),
                                    _InfoCell(
                                      label: 'Per Instalment',
                                      value: currencyFormat.format(app.installmentAmount),
                                    ),
                                    _InfoCell(
                                      label: 'Rate',
                                      value: '${app.interestRate.toStringAsFixed(1)}%',
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Icon(Icons.access_time_rounded, size: 16,
                                      color: AppTheme.getTextSecondary(context)),
                                  const SizedBox(width: 6),
                                  Text(
                                    DateFormat('MMM dd, yyyy').format(app.createdAt),
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: AppTheme.getTextSecondary(context),
                                        fontWeight: FontWeight.w500),
                                  ),
                                  if (app.merchantId.isNotEmpty) ...[
                                    const Spacer(),
                                    Icon(Icons.store_rounded, size: 14,
                                        color: AppTheme.getTextSecondary(context)),
                                    const SizedBox(width: 4),
                                    Text(app.merchantId,
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: AppTheme.getTextSecondary(context))),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
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
            style: TextStyle(fontSize: 10, color: AppTheme.getTextSecondary(context))),
        const SizedBox(height: 2),
        Text(value,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: AppTheme.getTextPrimary(context))),
      ],
    );
  }
}
