import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/bnpl_application.dart';
import '../../services/bnpl_service.dart';
import '../../../config/app_theme.dart';

class BNPLDetailsScreen extends StatefulWidget {
  final BNPLApplication application;

  const BNPLDetailsScreen({super.key, required this.application});

  @override
  State<BNPLDetailsScreen> createState() => _BNPLDetailsScreenState();
}

class _BNPLDetailsScreenState extends State<BNPLDetailsScreen>
    with SingleTickerProviderStateMixin {
  final BNPLService _service = BNPLService();
  late TabController _tabController;

  List<Map<String, dynamic>> _schedule = [];
  bool _loadingSchedule = false;
  String? _scheduleError;

  final _currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.index == 1 && _schedule.isEmpty && !_loadingSchedule) {
        _fetchSchedule();
      }
    });
  }

  Future<void> _fetchSchedule() async {
    setState(() {
      _loadingSchedule = true;
      _scheduleError = null;
    });
    try {
      final response =
          await _service.getRepaymentSchedule(widget.application.applicationId);
      if (response.statusCode == 200) {
        final data = response.data;
        final items = (data['schedule'] ?? data['items'] ?? data) as List? ?? [];
        setState(() {
          _schedule = items.cast<Map<String, dynamic>>();
        });
      } else {
        setState(() => _scheduleError = 'Failed to load schedule');
      }
    } catch (e) {
      setState(() => _scheduleError = e.toString());
    } finally {
      setState(() => _loadingSchedule = false);
    }
  }

  Color _statusColor(String status) {
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
      case 'paid':
        return Colors.green;
      case 'overdue':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.application;
    final statusColor = _statusColor(app.status);

    return Scaffold(
      appBar: AppBar(
        title: const Text('BNPL Details', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Theme.of(context).colorScheme.primary,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Repayment Schedule'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _OverviewTab(
            app: app,
            statusColor: statusColor,
            currencyFormat: _currencyFormat,
          ),
          _ScheduleTab(
            schedule: _schedule,
            loading: _loadingSchedule,
            error: _scheduleError,
            onRetry: _fetchSchedule,
            currencyFormat: _currencyFormat,
            statusColor: _statusColor,
          ),
        ],
      ),
    );
  }
}

class _OverviewTab extends StatelessWidget {
  final BNPLApplication app;
  final Color statusColor;
  final NumberFormat currencyFormat;

  const _OverviewTab({
    required this.app,
    required this.statusColor,
    required this.currencyFormat,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status header card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  statusColor.withOpacity(0.15),
                  statusColor.withOpacity(0.05),
                ],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: statusColor.withOpacity(0.3)),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.credit_card_rounded, color: statusColor, size: 36),
                ),
                const SizedBox(height: 12),
                Text(
                  app.productDescription.isNotEmpty
                      ? app.productDescription
                      : 'BNPL Purchase',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.getTextPrimary(context),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withOpacity(0.4)),
                  ),
                  child: Text(
                    app.status.toUpperCase(),
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Financial summary
          _SectionCard(
            title: 'Financial Summary',
            icon: Icons.attach_money_rounded,
            children: [
              _DetailRow('Purchase Amount', currencyFormat.format(app.purchaseAmount)),
              _DetailRow('Per Instalment', currencyFormat.format(app.installmentAmount)),
              _DetailRow('Total Instalments', '${app.installmentCount}×'),
              _DetailRow('Interest Rate', '${app.interestRate.toStringAsFixed(2)}%'),
              _DetailRow(
                'Total Repayment',
                currencyFormat.format(app.installmentAmount * app.installmentCount),
                highlight: true,
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Application details
          _SectionCard(
            title: 'Application Details',
            icon: Icons.info_outline_rounded,
            children: [
              _DetailRow('Application ID', app.applicationId, monospace: true),
              if (app.merchantId.isNotEmpty)
                _DetailRow('Merchant ID', app.merchantId),
              if (app.creditScore > 0)
                _DetailRow('Credit Score', app.creditScore.toString()),
              _DetailRow('BVN Verified', app.bvnVerified ? 'Yes' : 'No'),
              _DetailRow('Applied On', DateFormat('MMM dd, yyyy').format(app.createdAt)),
              _DetailRow('Last Updated', DateFormat('MMM dd, yyyy').format(app.updatedAt)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ScheduleTab extends StatelessWidget {
  final List<Map<String, dynamic>> schedule;
  final bool loading;
  final String? error;
  final VoidCallback onRetry;
  final NumberFormat currencyFormat;
  final Color Function(String) statusColor;

  const _ScheduleTab({
    required this.schedule,
    required this.loading,
    required this.error,
    required this.onRetry,
    required this.currencyFormat,
    required this.statusColor,
  });

  String _formatDate(dynamic date) {
    if (date == null) return '—';
    try {
      return DateFormat('MMM dd, yyyy').format(DateTime.parse(date.toString()));
    } catch (_) {
      return date.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 56,
                color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text(error!, style: TextStyle(color: AppTheme.getTextSecondary(context))),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              label: const Text('Retry', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    if (schedule.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF7C3AED).withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.schedule_rounded, size: 56, color: Color(0xFF7C3AED)),
            ),
            const SizedBox(height: 16),
            Text('No schedule available',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600,
                    color: AppTheme.getTextPrimary(context))),
            const SizedBox(height: 8),
            Text('Schedule will appear once the application is approved',
                style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 13),
                textAlign: TextAlign.center),
            const SizedBox(height: 20),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Refresh'),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: schedule.length,
      itemBuilder: (context, index) {
        final item = schedule[index];
        final status = (item['status'] ?? 'pending').toString();
        final color = statusColor(status);
        final installmentNo = item['installment_no'] ?? item['instalment_no'] ?? (index + 1);
        final dueDate = _formatDate(item['due_date']);
        final amount = (item['amount'] as num?)?.toDouble() ?? 0.0;
        final paidAt = item['paid_at'];

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.getCardBackground(context),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withOpacity(0.2)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '#$installmentNo',
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Due: $dueDate',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.getTextPrimary(context),
                        )),
                    if (paidAt != null)
                      Text('Paid: ${_formatDate(paidAt)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.getTextSecondary(context),
                          )),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(currencyFormat.format(amount),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.getTextPrimary(context),
                      )),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      status.toUpperCase(),
                      style: TextStyle(
                        color: color,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Theme.of(context).dividerColor.withOpacity(0.3),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 8),
                Text(title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: AppTheme.getTextPrimary(context),
                    )),
              ],
            ),
          ),
          const Divider(height: 1),
          ...children,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  final bool monospace;

  const _DetailRow(
    this.label,
    this.value, {
    this.highlight = false,
    this.monospace = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: AppTheme.getTextSecondary(context),
              ),
            ),
          ),
          Expanded(
            flex: 6,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: highlight ? FontWeight.w800 : FontWeight.w600,
                color: highlight
                    ? Theme.of(context).colorScheme.primary
                    : AppTheme.getTextPrimary(context),
                fontFamily: monospace ? 'monospace' : null,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
