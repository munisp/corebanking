import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../providers/dispute_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../models/dispute.dart';
import 'create_dispute_screen.dart';
import 'dispute_details_screen.dart';

class DisputesListScreen extends StatefulWidget {
  const DisputesListScreen({super.key});

  @override
  State<DisputesListScreen> createState() => _DisputesListScreenState();
}

class _DisputesListScreenState extends State<DisputesListScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    // Clear any previous errors when screen initializes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DisputeProvider>().clearError();
      _loadDisputes();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadDisputes() async {
    // Clear error before loading
    context.read<DisputeProvider>().clearError();
    await context.read<DisputeProvider>().fetchAllDisputes();
  }

  Future<void> _handleRefresh() async {
    // Clear error before refreshing
    context.read<DisputeProvider>().clearError();
    await context.read<DisputeProvider>().fetchAllDisputes();
  }

  void _navigateToCreateDispute() async {
    // Clear error before navigating
    context.read<DisputeProvider>().clearError();
    
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const CreateDisputeScreen(),
      ),
    );

    // Always clear error when coming back
    context.read<DisputeProvider>().clearError();
    
    if (result == true) {
      _loadDisputes();
    }
  }

  void _navigateToDetails(Dispute dispute) async {
    // Clear error before navigating
    context.read<DisputeProvider>().clearError();
    
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DisputeDetailsScreen(dispute: dispute),
      ),
    );

    // Always clear error when coming back from detail screen
    context.read<DisputeProvider>().clearError();
    
    if (result == true) {
      _loadDisputes();
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'open':
      case 'pending':
        return Colors.orange;
      case 'under_review':
        return Colors.blue;
      case 'resolved':
        return Colors.green;
      case 'rejected':
        return Colors.red;
      case 'escalated':
        return Colors.deepOrange;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'open':
      case 'pending':
        return Icons.schedule_rounded;
      case 'under_review':
        return Icons.search_rounded;
      case 'resolved':
        return Icons.check_circle_rounded;
      case 'rejected':
        return Icons.cancel_rounded;
      case 'escalated':
        return Icons.priority_high_rounded;
      default:
        return Icons.help_rounded;
    }
  }

  IconData _getCategoryIcon(String disputeType) {
    switch (disputeType.toUpperCase()) {
      case 'UNAUTHORIZED':
        return Icons.security_rounded;
      case 'SERVICE_NOT_RECEIVED':
        return Icons.wifi_off_rounded;
      case 'INCORRECT_AMOUNT':
        return Icons.receipt_long_rounded;
      case 'INSURANCE':
        return Icons.shield_rounded;
      case 'DUPLICATE_CHARGE':
        return Icons.content_copy_rounded;
      default:
        return Icons.report_problem_rounded;
    }
  }

  String _getDisputeTypeDisplay(String disputeType) {
    switch (disputeType.toUpperCase()) {
      case 'UNAUTHORIZED':
        return 'Unauthorized';
      case 'SERVICE_NOT_RECEIVED':
        return 'Service Not Received';
      case 'INCORRECT_AMOUNT':
        return 'Incorrect Amount';
      case 'INSURANCE':
        return 'Insurance';
      case 'DUPLICATE_CHARGE':
        return 'Duplicate Charge';
      default:
        return disputeType;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Disputes',
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
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Open'),
            Tab(text: 'Under Review'),
            Tab(text: 'Resolved'),
          ],
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
                  onPressed: _navigateToCreateDispute,
                  tooltip: 'Create New Dispute',
                ),
              );
            },
          ),
        ],
      ),
      body: Consumer<DisputeProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.errorMessage != null) {
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
                    child: Icon(
                      Icons.error_outline_rounded,
                      size: 64,
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Error loading disputes',
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
                      provider.errorMessage!,
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
                          onPressed: _loadDisputes,
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
            );
          }

          return TabBarView(
            controller: _tabController,
            children: [
              _buildDisputesList(provider.disputesList),
              _buildDisputesList(provider.getDisputesByStatus('open')),
              _buildDisputesList(provider.getDisputesByStatus('under_review')),
              _buildDisputesList(provider.getDisputesByStatus('resolved')),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDisputesList(List<Dispute> disputes) {
    if (disputes.isEmpty) {
      return Center(
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
                Icons.gavel_rounded,
                size: 80,
                color: Theme.of(context).colorScheme.primary.withOpacity(0.6),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'No Disputes',
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
                'No disputes found in this category',
                style: TextStyle(
                  color: AppTheme.getTextSecondary(context),
                  fontSize: 14,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _handleRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: disputes.length,
        itemBuilder: (context, index) {
          final dispute = disputes[index];
          return _buildDisputeCard(dispute);
        },
      ),
    );
  }

  Widget _buildDisputeCard(Dispute dispute) {
    final statusColor = _getStatusColor(dispute.status);
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);
    
    // Get dispute type from the API response (it's in the category field based on the JSON)
    final String disputeType = dispute.category.toUpperCase();
    
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
          onTap: () => _navigateToDetails(dispute),
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
                      child: Row(
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
                              _getCategoryIcon(disputeType),
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
                                  'Dispute #${dispute.id.length > 8 ? dispute.id.substring(dispute.id.length - 8) : dispute.id}',
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
                                    _getDisputeTypeDisplay(disputeType),
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
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _getStatusIcon(dispute.status),
                            size: 14,
                            color: statusColor,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            dispute.status.toUpperCase(),
                            style: TextStyle(
                              color: statusColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Description
                if (dispute.description.isNotEmpty) ...[
                  Text(
                    dispute.description,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppTheme.getTextSecondary(context),
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 12),
                ],
                
                // Amount and transaction ID box
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
                            'Disputed Amount',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextSecondary(context),
                            ),
                          ),
                          Text(
                            currencyFormat.format(dispute.disputedAmount),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.getTextPrimary(context),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Divider(
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                        height: 1,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Transaction ID',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextSecondary(context),
                            ),
                          ),
                          Text(
                            (dispute.transactionId.length > 15)
                                ? '...${dispute.transactionId.substring(dispute.transactionId.length - 15)}'
                                : dispute.transactionId,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextPrimary(context),
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 12),
                
                // Date and resolution info
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.access_time_rounded,
                          size: 16,
                          color: AppTheme.getTextSecondary(context),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          DateFormat('MMM dd, yyyy').format(dispute.createdAt),
                          style: TextStyle(
                            fontSize: 13,
                            color: AppTheme.getTextSecondary(context),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    if (dispute.resolutionNotes != null && dispute.resolutionNotes!.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: dispute.isResolved 
                              ? Colors.green.withOpacity(0.1)
                              : Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: dispute.isResolved
                                ? Colors.green.withOpacity(0.3)
                                : Colors.red.withOpacity(0.3),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              dispute.isResolved
                                  ? Icons.check_circle_outline_rounded
                                  : Icons.cancel_outlined,
                              size: 14,
                              color: dispute.isResolved
                                  ? Colors.green
                                  : Colors.red,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              dispute.statusDisplay.toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: dispute.isResolved
                                    ? Colors.green
                                    : Colors.red,
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
        ),
      ),
    );
  }
}
