import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../services/van_service.dart' as van_svc;
import '../../../services/account_service.dart';
import '../../../providers/tenant_provider.dart';
import '../../../config/app_theme.dart';

/// Virtual Account Number (VAN) Management Screen
/// Allows customers to create, view, and manage their virtual accounts
class VANManagementScreen extends StatefulWidget {
  const VANManagementScreen({super.key});

  @override
  State<VANManagementScreen> createState() => _VANManagementScreenState();
}

class _VANManagementScreenState extends State<VANManagementScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = false;
  String? _errorMessage;
  List<VirtualAccount> _virtualAccounts = [];
  List<VANPayment> _recentPayments = [];

  final van_svc.VANService _vanService = van_svc.VANService.instance;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadVirtualAccounts();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadVirtualAccounts() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      // Load virtual accounts from API
      final accounts = await _vanService.getVirtualAccounts();
      final payments = await _vanService.getPayments();
      
      setState(() {
        _virtualAccounts = accounts.map((acc) => VirtualAccount(
          id: acc.id,
          accountNumber: acc.accountNumber,
          purpose: _mapPurpose(acc.purpose),
          label: acc.label,
          balance: acc.balance,
          totalReceived: acc.totalReceived,
          status: _mapStatus(acc.status),
          createdAt: acc.createdAt,
          expiresAt: acc.expiresAt,
          isSingleUse: acc.isSingleUse,
        )).toList();
        
        _recentPayments = payments.map((pay) => VANPayment(
          id: pay.id,
          vanId: pay.vanId,
          amount: pay.amount,
          senderName: pay.senderName,
          senderBank: pay.senderBank,
          reference: pay.reference,
          status: _mapPaymentStatus(pay.status),
          receivedAt: pay.receivedAt,
        )).toList();
      });
    } on Exception catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading accounts: ${e.toString()}'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load accounts';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  VANPurpose _mapPurpose(van_svc.VANPurpose purpose) {
    switch (purpose) {
      case van_svc.VANPurpose.loanCollection:
        return VANPurpose.loanCollection;
      case van_svc.VANPurpose.merchant:
        return VANPurpose.merchant;
      case van_svc.VANPurpose.escrow:
        return VANPurpose.escrow;
      case van_svc.VANPurpose.agent:
        return VANPurpose.agent;
      case van_svc.VANPurpose.payroll:
        return VANPurpose.payroll;
    }
  }

  VANStatus _mapStatus(van_svc.VANStatus status) {
    switch (status) {
      case van_svc.VANStatus.active:
        return VANStatus.active;
      case van_svc.VANStatus.suspended:
        return VANStatus.suspended;
      case van_svc.VANStatus.inactive:
        return VANStatus.inactive;
      case van_svc.VANStatus.expired:
        return VANStatus.expired;
    }
  }

  PaymentStatus _mapPaymentStatus(van_svc.PaymentStatus status) {
    switch (status) {
      case van_svc.PaymentStatus.pending:
        return PaymentStatus.pending;
      case van_svc.PaymentStatus.completed:
        return PaymentStatus.completed;
      case van_svc.PaymentStatus.failed:
        return PaymentStatus.failed;
      case van_svc.PaymentStatus.reversed:
        return PaymentStatus.reversed;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Virtual Accounts'),
        backgroundColor: tenantProvider.primaryColor,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'My VANs', icon: Icon(Icons.account_balance_wallet)),
            Tab(text: 'Payments', icon: Icon(Icons.payments)),
            Tab(text: 'Analytics', icon: Icon(Icons.analytics)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadVirtualAccounts,
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildVANListTab(),
          _buildPaymentsTab(),
          _buildAnalyticsTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateVANDialog(context),
        backgroundColor: tenantProvider.primaryColor,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Create VAN'),
      ),
    );
  }

  Widget _buildVANListTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_virtualAccounts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.account_balance_wallet_outlined,
                size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No Virtual Accounts Yet',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Create a VAN to receive payments for loans,\nescrow, or merchant collections',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _showCreateVANDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('Create Your First VAN'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadVirtualAccounts,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _virtualAccounts.length,
        itemBuilder: (context, index) {
          final van = _virtualAccounts[index];
          return _VANCard(
            van: van,
            onTap: () => _showVANDetails(context, van),
            onCopyAccount: () => _copyToClipboard(van.accountNumber),
            onShare: () => _shareVAN(van),
          );
        },
      ),
    );
  }

  Widget _buildPaymentsTab() {
    if (_recentPayments.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.payments_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No Payments Yet',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Payments received on your VANs will appear here',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _recentPayments.length,
      itemBuilder: (context, index) {
        final payment = _recentPayments[index];
        return _PaymentCard(payment: payment);
      },
    );
  }

  Widget _buildAnalyticsTab() {
    final totalReceived = _virtualAccounts.fold<double>(
        0, (sum, van) => sum + van.totalReceived);
    final totalBalance =
        _virtualAccounts.fold<double>(0, (sum, van) => sum + van.balance);
    final activeVANs =
        _virtualAccounts.where((v) => v.status == VANStatus.active).length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Summary Cards
          Row(
            children: [
              Expanded(
                child: _SummaryCard(
                  title: 'Total Received',
                  value: _formatCurrency(totalReceived),
                  icon: Icons.arrow_downward,
                  color: AppTheme.successColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(
                  title: 'Current Balance',
                  value: _formatCurrency(totalBalance),
                  icon: Icons.account_balance_wallet,
                  color: Provider.of<TenantProvider>(context).primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _SummaryCard(
                  title: 'Active VANs',
                  value: activeVANs.toString(),
                  icon: Icons.check_circle,
                  color: AppTheme.successColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(
                  title: 'Total Payments',
                  value: _recentPayments.length.toString(),
                  icon: Icons.receipt_long,
                  color: AppTheme.warningColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // VAN by Purpose
          Text(
            'VANs by Purpose',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          ..._buildPurposeBreakdown(),

          const SizedBox(height: 24),

          // Monthly Trend (placeholder)
          Text(
            'Monthly Collections',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppTheme.getTextPrimary(context),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: AppTheme.getCardBackground(context),
              border: Border.all(color: AppTheme.getBorderColor(context)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.bar_chart,
                    size: 48,
                    color: AppTheme.getTextSecondary(context).withOpacity(0.5),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Chart Coming Soon',
                    style: TextStyle(
                      color: AppTheme.getTextSecondary(context),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Monthly collection trends will appear here',
                    style: TextStyle(
                      color: AppTheme.getTextSecondary(context).withOpacity(0.7),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPurposeBreakdown() {
    final purposeCounts = <VANPurpose, int>{};
    for (final van in _virtualAccounts) {
      purposeCounts[van.purpose] = (purposeCounts[van.purpose] ?? 0) + 1;
    }

    return purposeCounts.entries.map((entry) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Icon(_getPurposeIcon(entry.key), size: 20),
            const SizedBox(width: 8),
            Expanded(child: Text(_getPurposeLabel(entry.key))),
            Text('${entry.value}',
                style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }).toList();
  }

  void _showCreateVANDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _CreateVANSheet(
        onCreated: (van) {
          setState(() => _virtualAccounts.insert(0, van));
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('VAN ${van.accountNumber} created successfully'),
              backgroundColor: AppTheme.successColor,
            ),
          );
        },
      ),
    );
  }

  void _showVANDetails(BuildContext context, VirtualAccount van) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VANDetailsScreen(van: van),
      ),
    );
  }

  void _copyToClipboard(String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Account number copied to clipboard')),
    );
  }

  void _shareVAN(VirtualAccount van) {
    // Implement share functionality
    final shareText = '''
Virtual Account Details:
Account Number: ${van.accountNumber}
Bank: pup
Purpose: ${_getPurposeLabel(van.purpose)}
Label: ${van.label}
''';
    // Share.share(shareText);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Share: $shareText')),
    );
  }

  String _formatCurrency(double amount) {
    return '₦${amount.toStringAsFixed(2).replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]},',
        )}';
  }

  IconData _getPurposeIcon(VANPurpose purpose) {
    switch (purpose) {
      case VANPurpose.loanCollection:
        return Icons.account_balance;
      case VANPurpose.merchant:
        return Icons.store;
      case VANPurpose.escrow:
        return Icons.security;
      case VANPurpose.agent:
        return Icons.person;
      case VANPurpose.payroll:
        return Icons.people;
    }
  }

  String _getPurposeLabel(VANPurpose purpose) {
    switch (purpose) {
      case VANPurpose.loanCollection:
        return 'Loan Collection';
      case VANPurpose.merchant:
        return 'Merchant';
      case VANPurpose.escrow:
        return 'Escrow';
      case VANPurpose.agent:
        return 'Agent Banking';
      case VANPurpose.payroll:
        return 'Payroll';
    }
  }
}

// VAN Card Widget
class _VANCard extends StatelessWidget {
  final VirtualAccount van;
  final VoidCallback onTap;
  final VoidCallback onCopyAccount;
  final VoidCallback onShare;

  const _VANCard({
    required this.van,
    required this.onTap,
    required this.onCopyAccount,
    required this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _getPurposeColor(van.purpose, context).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      _getPurposeIcon(van.purpose),
                      color: _getPurposeColor(van.purpose, context),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          van.label,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          _getPurposeLabel(van.purpose),
                          style: TextStyle(
                            color: AppTheme.getTextSecondary(context),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _StatusBadge(status: van.status),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.getCardBackground(context),
                  border: Border.all(color: AppTheme.getBorderColor(context)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Account Number',
                            style: TextStyle(
                              color: AppTheme.getTextSecondary(context),
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            van.accountNumber,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.copy),
                      onPressed: onCopyAccount,
                      tooltip: 'Copy',
                    ),
                    IconButton(
                      icon: const Icon(Icons.share),
                      onPressed: onShare,
                      tooltip: 'Share',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Balance',
                          style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 12),
                        ),
                        Text(
                          _formatCurrency(van.balance),
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Received',
                          style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 12),
                        ),
                        Text(
                          _formatCurrency(van.totalReceived),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: AppTheme.successColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (van.expiresAt != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.schedule, size: 14, color: AppTheme.getTextSecondary(context)),
                    const SizedBox(width: 4),
                    Text(
                      'Expires: ${_formatDate(van.expiresAt!)}',
                      style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 12),
                    ),
                    if (van.isSingleUse) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.warningColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Single Use',
                          style: TextStyle(
                            color: AppTheme.warningColor,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _getPurposeColor(VANPurpose purpose, BuildContext context) {
    final tenantColor = Provider.of<TenantProvider>(context, listen: false).primaryColor;
    switch (purpose) {
      case VANPurpose.loanCollection:
        return tenantColor;
      case VANPurpose.merchant:
        return AppTheme.secondaryColor;
      case VANPurpose.escrow:
        return AppTheme.successColor;
      case VANPurpose.agent:
        return AppTheme.warningColor;
      case VANPurpose.payroll:
        return tenantColor.withOpacity(0.7);
    }
  }

  IconData _getPurposeIcon(VANPurpose purpose) {
    switch (purpose) {
      case VANPurpose.loanCollection:
        return Icons.account_balance;
      case VANPurpose.merchant:
        return Icons.store;
      case VANPurpose.escrow:
        return Icons.security;
      case VANPurpose.agent:
        return Icons.person;
      case VANPurpose.payroll:
        return Icons.people;
    }
  }

  String _getPurposeLabel(VANPurpose purpose) {
    switch (purpose) {
      case VANPurpose.loanCollection:
        return 'Loan Collection';
      case VANPurpose.merchant:
        return 'Merchant';
      case VANPurpose.escrow:
        return 'Escrow';
      case VANPurpose.agent:
        return 'Agent Banking';
      case VANPurpose.payroll:
        return 'Payroll';
    }
  }

  String _formatCurrency(double amount) {
    return '₦${amount.toStringAsFixed(2).replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]},',
        )}';
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}

// Status Badge Widget
class _StatusBadge extends StatelessWidget {
  final VANStatus status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;

    switch (status) {
      case VANStatus.active:
        color = AppTheme.successColor;
        label = 'Active';
        break;
      case VANStatus.suspended:
        color = AppTheme.warningColor;
        label = 'Suspended';
        break;
      case VANStatus.inactive:
        color = AppTheme.getTextSecondary(context);
        label = 'Inactive';
        break;
      case VANStatus.expired:
        color = AppTheme.errorColor;
        label = 'Expired';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

// Payment Card Widget
class _PaymentCard extends StatelessWidget {
  final VANPayment payment;

  const _PaymentCard({required this.payment});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppTheme.successColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.arrow_downward, color: AppTheme.successColor),
        ),
        title: Text(
          '₦${payment.amount.toStringAsFixed(2)}',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('From: ${payment.senderName}'),
            Text(
              '${payment.senderBank} • ${payment.reference}',
              style: TextStyle(color: Colors.grey[600], fontSize: 12),
            ),
          ],
        ),
        trailing: Text(
          _formatTime(payment.receivedAt),
          style: TextStyle(color: Colors.grey[600], fontSize: 12),
        ),
        isThreeLine: true,
      ),
    );
  }

  String _formatTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inHours < 1) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }
}

// Summary Card Widget
class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Create VAN Sheet
class _CreateVANSheet extends StatefulWidget {
  final Function(VirtualAccount) onCreated;

  const _CreateVANSheet({required this.onCreated});

  @override
  State<_CreateVANSheet> createState() => _CreateVANSheetState();
}

class _CreateVANSheetState extends State<_CreateVANSheet> {
  final _formKey = GlobalKey<FormState>();
  final _labelController = TextEditingController();
  final _minAmountController = TextEditingController();
  final _maxAmountController = TextEditingController();
  VANPurpose _selectedPurpose = VANPurpose.merchant;
  bool _isSingleUse = false;
  bool _hasExpiry = false;
  DateTime? _expiryDate;
  bool _isCreating = false;

  Account? _linkedAccount;
  bool _loadingAccount = true;

  @override
  void initState() {
    super.initState();
    _loadLinkedAccount();
  }

  Future<void> _loadLinkedAccount() async {
    try {
      final account = await AccountService().getAccountByKeycloakId('');
      if (mounted) setState(() => _linkedAccount = account);
    } catch (_) {
      // account load failed — user will see a warning in the form
    } finally {
      if (mounted) setState(() => _loadingAccount = false);
    }
  }

  @override
  void dispose() {
    _labelController.dispose();
    _minAmountController.dispose();
    _maxAmountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Create Virtual Account',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Purpose Selection
              const Text('Purpose',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: VANPurpose.values.map((purpose) {
                  final isSelected = _selectedPurpose == purpose;
                  return ChoiceChip(
                    label: Text(_getPurposeLabel(purpose)),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedPurpose = purpose);
                      }
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              // Linked account (auto-resolved from user session)
              const Text('Linked Account', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (_loadingAccount)
                Container(
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppTheme.getBorderColor(context).withOpacity(0.3),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(child: SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                )
              else if (_linkedAccount != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.getCardBackground(context),
                    border: Border.all(color: AppTheme.getBorderColor(context)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.account_balance, color: Provider.of<TenantProvider>(context, listen: false).primaryColor),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_linkedAccount!.accountName, style: const TextStyle(fontWeight: FontWeight.bold)),
                            Text(_linkedAccount!.accountNumber, style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor.withOpacity(0.08),
                    border: Border.all(color: AppTheme.errorColor.withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber, color: AppTheme.errorColor, size: 18),
                      const SizedBox(width: 8),
                      const Expanded(child: Text('Could not load your account. Please try again.', style: TextStyle(fontSize: 13))),
                    ],
                  ),
                ),
              const SizedBox(height: 4),
              Text(
                'Payments received on this VAN will credit your account directly.',
                style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 12),
              ),
              const SizedBox(height: 16),

              // Label
              TextFormField(
                controller: _labelController,
                decoration: const InputDecoration(
                  labelText: 'Label / Description',
                  hintText: 'e.g., Car Loan Repayment',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter a label';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Amount Limits
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _minAmountController,
                      decoration: const InputDecoration(
                        labelText: 'Min Amount (Optional)',
                        prefixText: '₦',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _maxAmountController,
                      decoration: const InputDecoration(
                        labelText: 'Max Amount (Optional)',
                        prefixText: '₦',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Options
              SwitchListTile(
                title: const Text('Single Use'),
                subtitle: const Text('VAN will be deactivated after first payment'),
                value: _isSingleUse,
                onChanged: (value) => setState(() => _isSingleUse = value),
                contentPadding: EdgeInsets.zero,
              ),
              SwitchListTile(
                title: const Text('Set Expiry Date'),
                subtitle: const Text('VAN will expire on specified date'),
                value: _hasExpiry,
                onChanged: (value) {
                  setState(() {
                    _hasExpiry = value;
                    if (value && _expiryDate == null) {
                      _expiryDate = DateTime.now().add(const Duration(days: 30));
                    }
                  });
                },
                contentPadding: EdgeInsets.zero,
              ),
              if (_hasExpiry) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate:
                          _expiryDate ?? DateTime.now().add(const Duration(days: 30)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date != null) {
                      setState(() => _expiryDate = date);
                    }
                  },
                  icon: const Icon(Icons.calendar_today),
                  label: Text(
                    _expiryDate != null
                        ? '${_expiryDate!.day}/${_expiryDate!.month}/${_expiryDate!.year}'
                        : 'Select Date',
                  ),
                ),
              ],
              const SizedBox(height: 24),

              // Fee Notice
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Provider.of<TenantProvider>(context).primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Provider.of<TenantProvider>(context).primaryColor),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'VAN creation fee: ₦50.00\nMonthly maintenance: ₦100.00',
                        style: TextStyle(color: Provider.of<TenantProvider>(context).primaryColor, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Create Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: (_isCreating || _loadingAccount || _linkedAccount == null) ? null : _createVAN,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Provider.of<TenantProvider>(context, listen: false).primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isCreating
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Create Virtual Account'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getPurposeLabel(VANPurpose purpose) {
    switch (purpose) {
      case VANPurpose.loanCollection:
        return 'Loan';
      case VANPurpose.merchant:
        return 'Merchant';
      case VANPurpose.escrow:
        return 'Escrow';
      case VANPurpose.agent:
        return 'Agent';
      case VANPurpose.payroll:
        return 'Payroll';
    }
  }

  Future<void> _createVAN() async {
    if (!_formKey.currentState!.validate()) return;

    if (_linkedAccount == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: const Text('Your account could not be loaded. Please try again.'), backgroundColor: AppTheme.errorColor),
      );
      return;
    }

    setState(() => _isCreating = true);

    try {
      // Create VAN via API
      final vanService = van_svc.VANService.instance;
      final request = van_svc.CreateVANRequest(
        purpose: _mapToServicePurpose(_selectedPurpose),
        label: _labelController.text,
        expiresAt: _hasExpiry ? _expiryDate : null,
        isSingleUse: _isSingleUse,
        linkedAccountId: _linkedAccount!.id,
      );
      
      final createdVan = await vanService.createVirtualAccount(request);

      final van = VirtualAccount(
        id: createdVan.id,
        accountNumber: createdVan.accountNumber,
        purpose: _selectedPurpose,
        label: createdVan.label,
        balance: createdVan.balance,
        totalReceived: createdVan.totalReceived,
        status: VANStatus.active,
        createdAt: createdVan.createdAt,
        expiresAt: createdVan.expiresAt,
        isSingleUse: createdVan.isSingleUse,
      );

      widget.onCreated(van);
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create VAN: ${e.toString()}'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      setState(() => _isCreating = false);
    }
  }

  van_svc.VANPurpose _mapToServicePurpose(VANPurpose purpose) {
    switch (purpose) {
      case VANPurpose.loanCollection:
        return van_svc.VANPurpose.loanCollection;
      case VANPurpose.merchant:
        return van_svc.VANPurpose.merchant;
      case VANPurpose.escrow:
        return van_svc.VANPurpose.escrow;
      case VANPurpose.agent:
        return van_svc.VANPurpose.agent;
      case VANPurpose.payroll:
        return van_svc.VANPurpose.payroll;
    }
  }
}

// VAN Details Screen
class VANDetailsScreen extends StatelessWidget {
  final VirtualAccount van;

  const VANDetailsScreen({super.key, required this.van});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('VAN Details'),
        backgroundColor: Provider.of<TenantProvider>(context, listen: false).primaryColor,
        foregroundColor: Colors.white,
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              switch (value) {
                case 'suspend':
                  // Handle suspend
                  break;
                case 'deactivate':
                  // Handle deactivate
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'suspend',
                child: Text('Suspend VAN'),
              ),
              const PopupMenuItem(
                value: 'deactivate',
                child: Text('Deactivate VAN'),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Account Number Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const Text('Account Number'),
                    const SizedBox(height: 8),
                    Text(
                      van.accountNumber,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'pup',
                      style: TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 12,
                      alignment: WrapAlignment.center,
                      children: [
                        OutlinedButton.icon(
                          onPressed: () {
                            Clipboard.setData(
                                ClipboardData(text: van.accountNumber));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Copied!')),
                            );
                          },
                          icon: const Icon(Icons.copy),
                          label: const Text('Copy'),
                        ),
                        OutlinedButton.icon(
                          onPressed: () {
                            // Share
                          },
                          icon: const Icon(Icons.share),
                          label: const Text('Share'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Details
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _DetailRow(label: 'Label', value: van.label),
                    _DetailRow(
                        label: 'Purpose', value: van.purpose.toString().split('.').last),
                    _DetailRow(
                        label: 'Status', value: van.status.toString().split('.').last),
                    _DetailRow(
                        label: 'Balance',
                        value: '₦${van.balance.toStringAsFixed(2)}'),
                    _DetailRow(
                        label: 'Total Received',
                        value: '₦${van.totalReceived.toStringAsFixed(2)}'),
                    _DetailRow(
                        label: 'Created',
                        value:
                            '${van.createdAt.day}/${van.createdAt.month}/${van.createdAt.year}'),
                    if (van.expiresAt != null)
                      _DetailRow(
                          label: 'Expires',
                          value:
                              '${van.expiresAt!.day}/${van.expiresAt!.month}/${van.expiresAt!.year}'),
                    if (van.isSingleUse)
                      const _DetailRow(label: 'Type', value: 'Single Use'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600])),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// Models
enum VANPurpose { loanCollection, merchant, escrow, agent, payroll }

enum VANStatus { active, suspended, inactive, expired }

enum PaymentStatus { pending, completed, failed, reversed }

class VirtualAccount {
  final String id;
  final String accountNumber;
  final VANPurpose purpose;
  final String label;
  final double balance;
  final double totalReceived;
  final VANStatus status;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final bool isSingleUse;

  VirtualAccount({
    required this.id,
    required this.accountNumber,
    required this.purpose,
    required this.label,
    required this.balance,
    required this.totalReceived,
    required this.status,
    required this.createdAt,
    this.expiresAt,
    this.isSingleUse = false,
  });
}

class VANPayment {
  final String id;
  final String vanId;
  final double amount;
  final String senderName;
  final String senderBank;
  final String reference;
  final PaymentStatus status;
  final DateTime receivedAt;

  VANPayment({
    required this.id,
    required this.vanId,
    required this.amount,
    required this.senderName,
    required this.senderBank,
    required this.reference,
    required this.status,
    required this.receivedAt,
  });
}
