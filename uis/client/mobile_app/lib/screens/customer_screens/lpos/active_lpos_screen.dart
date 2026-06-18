import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../services/lpo_service.dart';
import '../../../services/api_service.dart';
import '../../../providers/tenant_provider.dart';
import '../../../utils/theme_extensions.dart';

class ActiveLPOsScreen extends StatefulWidget {
  const ActiveLPOsScreen({super.key});

  @override
  State<ActiveLPOsScreen> createState() => _ActiveLPOsScreenState();
}

class _ActiveLPOsScreenState extends State<ActiveLPOsScreen> {
  // ignore: unused_field
  final LPOService _lpoService = LPOService(ApiService());
  List<Map<String, dynamic>> _activeLPOs = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadActiveLPOs();
  }

  Future<void> _loadActiveLPOs() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Matches web app: lpoService.getAllLPOs() returns array directly
      final lpos = await _lpoService.getAllLPOs();
      
      setState(() {
        _activeLPOs = lpos;
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
    await _loadActiveLPOs();
  }

  String _formatDate(dynamic dateValue) {
    if (dateValue == null) return 'N/A';
    try {
      if (dateValue is String) {
        // Handle ISO 8601 format: "2025-12-19T16:10:48.882461"
        if (dateValue.contains('T')) {
          final dateTime = DateTime.parse(dateValue);
          return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
        }
        // Handle date-only format: "2026-01-18"
        if (dateValue.length == 10 && dateValue.contains('-')) {
          final parts = dateValue.split('-');
          return '${parts[2]}/${parts[1]}/${parts[0]}';
        }
        return dateValue;
      }
      return dateValue.toString();
    } catch (e) {
      return dateValue.toString();
    }
  }

  Color _getStatusColor(String status, BuildContext context) {
    final theme = Theme.of(context);
    switch (status.toLowerCase()) {
      case 'approved':
        return theme.successColor;
      case 'pending':
      case 'under_review':
        return theme.warningColor;
      case 'disbursed':
        return theme.colorScheme.primary;
      case 'rejected':
        return theme.colorScheme.error;
      default:
        return theme.colorScheme.onSurface.withOpacity(0.5);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Active LPOs', style: TextStyle(fontWeight: FontWeight.bold)),
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
                    Navigator.pushNamed(context, '/lpo-application');
                  },
                  tooltip: 'Apply for New LPO',
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
                        Icon(Icons.error_outline,
                            size: 64, color: Colors.red[300]),
                        const SizedBox(height: 16),
                        Text(
                          'Error loading LPOs',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[700],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _errorMessage!,
                          style: TextStyle(color: Colors.grey[600]),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: _loadActiveLPOs,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : _activeLPOs.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.description_outlined,
                                size: 64, color: Colors.grey[400]),
                            const SizedBox(height: 16),
                            Text(
                              'No Active LPOs',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey[700],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Apply for LPO financing to get started',
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton.icon(
                              onPressed: () {
                                Navigator.pushNamed(context, '/lpo-application');
                              },
                              icon: const Icon(Icons.add),
                              label: const Text('Apply for LPO'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.primaryDark,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 24, vertical: 12),
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(20),
                        itemCount: _activeLPOs.length,
                        itemBuilder: (context, index) {
                          final lpo = _activeLPOs[index];
                          return _buildLPOCard(lpo);
                        },
                      ),
      ),
    );
  }

  Widget _buildLPOCard(Map<String, dynamic> lpo) {
    final statusColor = _getStatusColor(lpo['status'] ?? 'pending', context);
    
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
            Navigator.pushNamed(
              context,
              '/lpo-details',
              arguments: {'lpoId': lpo['lpo_id']},
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
                                  Icons.receipt_long_rounded,
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
                                      lpo['lpo_id'] ?? lpo['lpo_number'] ?? 'N/A',
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
                                        lpo['issuing_organization'] ?? lpo['supplier_name'] ?? 'N/A',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: AppTheme.getTextSecondary(context),
                                          fontWeight: FontWeight.w600,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
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
                        (lpo['status'] ?? 'N/A').toString().replaceAll('_', ' ').toUpperCase(),
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
                            'LPO Amount',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextSecondary(context),
                            ),
                          ),
                          Text(
                            '₦${(lpo['lpo_amount'] as num).toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.getTextPrimary(context),
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
                            'Financing Amount',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextSecondary(context),
                            ),
                          ),
                          Text(
                            '₦${(lpo['financing_amount'] as num).toStringAsFixed(2)}',
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
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppTheme.getTextSecondary(context).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(
                        Icons.calendar_today_rounded,
                        size: 14,
                        color: AppTheme.getTextSecondary(context),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _formatDate(lpo['created_at']),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.getTextSecondary(context),
                      ),
                    ),
                    const Spacer(),
                    if (lpo['repayment_due_date'] != null) ...[
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Icon(
                          Icons.event_rounded,
                          size: 14,
                          color: Colors.orange,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Due: ${_formatDate(lpo['repayment_due_date'])}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.orange,
                        ),
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppTheme.getTextSecondary(context).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Icon(
                          Icons.access_time_rounded,
                          size: 14,
                          color: AppTheme.getTextSecondary(context),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${lpo['repayment_days'] ?? 'N/A'} days',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.getTextSecondary(context),
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
