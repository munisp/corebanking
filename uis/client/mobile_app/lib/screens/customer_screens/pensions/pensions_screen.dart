import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../config/app_config.dart';
import '../../../config/app_theme.dart';
import '../../../services/api_service.dart';
import '../../../services/pension_service.dart';

// ─── PFA static reference data ───────────────────────────────────────────────

const _pfaList = [
  {'name': 'Premium Pension Limited', 'aum': '₦1.2 Trillion',  'rating': 4.5, 'roi': '12.5%'},
  {'name': 'Stanbic IBTC Pension',    'aum': '₦980 Billion',   'rating': 4.3, 'roi': '11.8%'},
  {'name': 'ARM Pension Managers',    'aum': '₦850 Billion',   'rating': 4.4, 'roi': '12.1%'},
  {'name': 'Leadway Pensure PFA',     'aum': '₦720 Billion',   'rating': 4.2, 'roi': '11.5%'},
  {'name': 'NLPC PFA',               'aum': '₦540 Billion',   'rating': 4.0, 'roi': '11.0%'},
  {'name': 'Sigma Pensions',          'aum': '₦430 Billion',   'rating': 3.9, 'roi': '10.8%'},
];

const _pfaOptions = [
  'ARM Pension',
  'Stanbic IBTC Pension',
  'NLPC PFA',
  'Premium Pension Limited',
  'Leadway Pensure PFA',
  'AXA Mansard Pension',
  'Crusader Sterling Pensions',
  'Sigma Pensions',
  'Trustfund Pensions',
];

// ─── Screen ───────────────────────────────────────────────────────────────────

class PensionsScreen extends StatefulWidget {
  const PensionsScreen({super.key});

  @override
  State<PensionsScreen> createState() => _PensionsScreenState();
}

class _PensionsScreenState extends State<PensionsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late PensionService _pensionService;

  List<PensionAccount> _accounts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _pensionService = PensionService(ApiService());
    _loadAccounts();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAccounts() async {
    setState(() { _loading = true; _error = null; });
    try {
      final accounts = await _pensionService.listAccounts();
      if (mounted) setState(() { _accounts = accounts; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  PensionAccount? get _primaryAccount =>
      _accounts.firstWhere((a) => a.accountType == 'individual', orElse: () => _accounts.isNotEmpty ? _accounts.first : _accounts.isEmpty ? throw StateError('empty') : _accounts.first);

  bool get _hasPrimary => _accounts.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pensions'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Register Account',
            onPressed: () => _showRegisterDialog(context),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'My RSA'),
            Tab(text: 'Accounts'),
            Tab(text: 'PFA List'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildMyRSATab(currencyFormat),
                    _buildAccountsTab(currencyFormat),
                    _buildPFAListTab(),
                  ],
                ),
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
          const SizedBox(height: 16),
          Text(
            'Failed to load pension data',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey[700]),
          ),
          const SizedBox(height: 8),
          Text(
            _error ?? '',
            style: TextStyle(fontSize: 12, color: Colors.grey[500]),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _loadAccounts,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  // ─── My RSA Tab ───────────────────────────────────────────────────────────

  Widget _buildMyRSATab(NumberFormat fmt) {
    if (!_hasPrimary) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.account_balance_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text('No pension account found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey[700])),
            const SizedBox(height: 8),
            Text('Register an account to get started.', style: TextStyle(color: Colors.grey[500])),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _showRegisterDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('Register Account'),
            ),
          ],
        ),
      );
    }

    final account = _primaryAccount!;
    final total = account.totalContributions;
    final employerPct = total > 0 ? (account.employerContribution / total) : 0.0;
    final employeePct = total > 0 ? (account.employeeContribution / total) : 0.0;

    return RefreshIndicator(
      onRefresh: _loadAccounts,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // RSA Balance Card
          Card(
            elevation: 4,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.primaryColor, AppTheme.primaryDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.account_balance_wallet, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text('RSA Balance', style: TextStyle(color: Colors.white70, fontSize: 14)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          account.status.toUpperCase(),
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    fmt.format(total),
                    style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        _rsaInfoRow('RSA Number', account.rsaNumber),
                        const SizedBox(height: 8),
                        _rsaInfoRow('PFA', account.pfa),
                        const SizedBox(height: 8),
                        _rsaInfoRow('Type', account.accountType.toUpperCase()),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Contribution Breakdown
          const Text('Contribution Breakdown', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _contributionRow('Employer Contribution', account.employerContribution, employerPct, Colors.blue, fmt),
                  const SizedBox(height: 16),
                  _contributionRow('Employee Contribution', account.employeeContribution, employeePct, Colors.green, fmt),
                  const SizedBox(height: 16),
                  const Divider(),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Balance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      Text(fmt.format(total), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryDark)),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Action buttons
          Row(
            children: [
              if (account.status == 'active')
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _doAction(account, 'pause'),
                    icon: const Icon(Icons.pause_circle_outline),
                    label: const Text('Pause'),
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                  ),
                ),
              if (account.status == 'inactive') ...[
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _doAction(account, 'resume'),
                    icon: const Icon(Icons.play_circle_outline),
                    label: const Text('Resume'),
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                  ),
                ),
              ],
              if (account.status != 'withdrawn') ...[
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _confirmWithdraw(account),
                    icon: const Icon(Icons.logout, color: Colors.red),
                    label: const Text('Withdraw', style: TextStyle(color: Colors.red)),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: Colors.red),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _rsaInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _contributionRow(String label, double amount, double pct, Color color, NumberFormat fmt) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
            Text(fmt.format(amount), style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: pct,
                  backgroundColor: color.withOpacity(0.2),
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                  minHeight: 8,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text('${(pct * 100).toStringAsFixed(1)}%',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ],
    );
  }

  // ─── Accounts Tab ─────────────────────────────────────────────────────────

  Widget _buildAccountsTab(NumberFormat fmt) {
    if (_accounts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.account_balance_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text('No accounts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey[700])),
            const SizedBox(height: 8),
            ElevatedButton.icon(
              onPressed: () => _showRegisterDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('Register Account'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadAccounts,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _accounts.length,
        itemBuilder: (context, index) => _buildAccountCard(_accounts[index], fmt),
      ),
    );
  }

  Widget _buildAccountCard(PensionAccount account, NumberFormat fmt) {
    final statusColor = account.status == 'active'
        ? Colors.green
        : account.status == 'inactive'
            ? Colors.orange
            : Colors.grey;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showAccountDetail(context, account),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(account.customerName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        Text('${account.rsaNumber} · ${account.pfa}', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      account.status.toUpperCase(),
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: statusColor),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(12)),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Total Contributions', style: TextStyle(fontSize: 13, color: Colors.grey[600])),
                        Text(fmt.format(account.totalContributions), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Employer', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                              Text(fmt.format(account.employerContribution), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.blue)),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Employee', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                              Text(fmt.format(account.employeeContribution), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.green)),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Type', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                              Text(account.accountType.toUpperCase(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── PFA List Tab ─────────────────────────────────────────────────────────

  Widget _buildPFAListTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: AppTheme.primaryColor.withOpacity(0.1),
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: AppTheme.primaryColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Compare licensed PFAs to find the best fit for your retirement goals.',
                    style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        ..._pfaList.map((pfa) => _buildPFACard(pfa)),
      ],
    );
  }

  Widget _buildPFACard(Map<String, dynamic> pfa) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () => _showPFADetails(pfa),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.account_balance, color: AppTheme.primaryColor, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(pfa['name'] as String, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text('AUM: ${pfa['aum']}', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.star, color: Colors.amber[700], size: 16),
                              const SizedBox(width: 4),
                              Text('${pfa['rating']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text('Rating', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        children: [
                          Text(pfa['roi'] as String, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green)),
                          const SizedBox(height: 4),
                          Text('ROI', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Dialogs ──────────────────────────────────────────────────────────────

  Future<void> _showRegisterDialog(BuildContext context) async {
    final formKey = GlobalKey<FormState>();
    String customerName = '';
    String accountType = 'individual';
    String pfa = '';
    String rsaNumber = '';
    String currency = 'NGN';
    double employerContribution = 0;
    double employeeContribution = 0;

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Register Pension Account'),
        content: SingleChildScrollView(
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Customer / Fund Name *'),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                  onSaved: (v) => customerName = v ?? '',
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: accountType,
                  decoration: const InputDecoration(labelText: 'Account Type *'),
                  items: const [
                    DropdownMenuItem(value: 'individual', child: Text('Individual')),
                    DropdownMenuItem(value: 'employer', child: Text('Employer')),
                  ],
                  onChanged: (v) => accountType = v ?? 'individual',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration: const InputDecoration(labelText: 'RSA Number *'),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                  onSaved: (v) => rsaNumber = v ?? '',
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: 'PFA *'),
                  items: _pfaOptions.map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
                  validator: (v) => v == null || v.isEmpty ? 'Select a PFA' : null,
                  onChanged: (v) => pfa = v ?? '',
                  onSaved: (v) => pfa = v ?? '',
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: currency,
                  decoration: const InputDecoration(labelText: 'Currency'),
                  items: const [
                    DropdownMenuItem(value: 'NGN', child: Text('NGN')),
                    DropdownMenuItem(value: 'USD', child: Text('USD')),
                    DropdownMenuItem(value: 'GBP', child: Text('GBP')),
                  ],
                  onChanged: (v) => currency = v ?? 'NGN',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Employer Contribution (₦)'),
                  keyboardType: TextInputType.number,
                  onSaved: (v) => employerContribution = double.tryParse(v ?? '0') ?? 0,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Employee Contribution (₦)'),
                  keyboardType: TextInputType.number,
                  onSaved: (v) => employeeContribution = double.tryParse(v ?? '0') ?? 0,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (formKey.currentState?.validate() != true) return;
              formKey.currentState?.save();
              try {
                await _pensionService.createAccount({
                  'customer_name': customerName,
                  'account_type': accountType,
                  'pfa': pfa,
                  'rsa_number': rsaNumber,
                  'currency': currency,
                  'status': 'active',
                  'employer_contribution': employerContribution,
                  'employee_contribution': employeeContribution,
                  'total_contributions': employerContribution + employeeContribution,
                });
                if (ctx.mounted) Navigator.pop(ctx);
                _loadAccounts();
              } catch (e) {
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: const Text('Register'),
          ),
        ],
      ),
    );
  }

  void _showAccountDetail(BuildContext context, PensionAccount account) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _AccountDetailSheet(account: account, service: _pensionService, onRefresh: _loadAccounts),
    );
  }

  void _showPFADetails(Map<String, dynamic> pfa) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(pfa['name'] as String),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Assets Under Management: ${pfa['aum']}'),
            const SizedBox(height: 8),
            Text('Rating: ${pfa['rating']} / 5.0'),
            const SizedBox(height: 8),
            Text('Return on Investment: ${pfa['roi']}'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  Future<void> _doAction(PensionAccount account, String action) async {
    try {
      if (action == 'pause') {
        await _pensionService.pause(account.id);
      } else if (action == 'resume') {
        await _pensionService.resume(account.id);
      }
      _loadAccounts();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _confirmWithdraw(PensionAccount account) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Withdraw Pension Account'),
        content: Text('Are you sure you want to withdraw the account for ${account.customerName}? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await _pensionService.withdraw(account.id);
        _loadAccounts();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
}

// ─── Account Detail Bottom Sheet ──────────────────────────────────────────────

class _AccountDetailSheet extends StatefulWidget {
  final PensionAccount account;
  final PensionService service;
  final VoidCallback onRefresh;

  const _AccountDetailSheet({required this.account, required this.service, required this.onRefresh});

  @override
  State<_AccountDetailSheet> createState() => _AccountDetailSheetState();
}

class _AccountDetailSheetState extends State<_AccountDetailSheet> {
  List<PensionContribution> _contributions = [];
  bool _contribLoading = false;
  int _tab = 0; // 0 = overview, 1 = contributions

  @override
  void initState() {
    super.initState();
    _loadContributions();
  }

  Future<void> _loadContributions() async {
    setState(() => _contribLoading = true);
    try {
      final c = await widget.service.getContributions(widget.account.id);
      if (mounted) setState(() { _contributions = c; _contribLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _contribLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(symbol: '₦', decimalDigits: 0);
    final account = widget.account;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.92,
      builder: (ctx, controller) => Column(
        children: [
          // Handle
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(child: Text(account.customerName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                _statusChip(account.status),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text('${account.rsaNumber} · ${account.pfa}', style: TextStyle(fontSize: 13, color: Colors.grey[600])),
          ),
          const SizedBox(height: 16),
          // Tab row
          Row(
            children: [
              _sheetTab('Overview', 0),
              _sheetTab('Contributions', 1),
            ],
          ),
          const Divider(height: 1),
          Expanded(
            child: _tab == 0
                ? _buildOverview(account, fmt, controller)
                : _buildContributions(fmt, controller),
          ),
        ],
      ),
    );
  }

  Widget _sheetTab(String label, int index) {
    final active = _tab == index;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _tab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: active ? AppTheme.primaryColor : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: active ? AppTheme.primaryColor : Colors.grey[600],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOverview(PensionAccount account, NumberFormat fmt, ScrollController controller) {
    final total = account.totalContributions;
    final employerPct = total > 0 ? account.employerContribution / total : 0.0;
    final employeePct = total > 0 ? account.employeeContribution / total : 0.0;

    return ListView(
      controller: controller,
      padding: const EdgeInsets.all(20),
      children: [
        // Totals
        _detailRow('Total Contributions', fmt.format(total), bold: true),
        _detailRow('Employer', fmt.format(account.employerContribution), color: Colors.blue),
        _detailRow('Employee', fmt.format(account.employeeContribution), color: Colors.green),
        const SizedBox(height: 12),
        // Bars
        _barRow('Employer', employerPct, Colors.blue),
        const SizedBox(height: 8),
        _barRow('Employee', employeePct, Colors.green),
        const Divider(height: 24),
        _detailRow('RSA Number', account.rsaNumber),
        _detailRow('PFA', account.pfa),
        _detailRow('Type', account.accountType.toUpperCase()),
        _detailRow('Currency', account.currency),
        const SizedBox(height: 20),
        // Actions
        if (account.status == 'active')
          _actionButton('Pause Account', Colors.orange, () async {
            await widget.service.pause(account.id);
            widget.onRefresh();
            if (mounted) Navigator.pop(context);
          }),
        if (account.status == 'inactive')
          _actionButton('Resume Account', AppTheme.primaryColor, () async {
            await widget.service.resume(account.id);
            widget.onRefresh();
            if (mounted) Navigator.pop(context);
          }),
        if (account.status != 'withdrawn')
          _actionButton('Withdraw Account', Colors.red, () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Confirm Withdrawal'),
                content: const Text('This cannot be undone. Continue?'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                  ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text('Withdraw')),
                ],
              ),
            );
            if (ok == true) {
              await widget.service.withdraw(account.id);
              widget.onRefresh();
              if (mounted) Navigator.pop(context);
            }
          }),
      ],
    );
  }

  Widget _buildContributions(NumberFormat fmt, ScrollController controller) {
    if (_contribLoading) return const Center(child: CircularProgressIndicator());
    if (_contributions.isEmpty) {
      return Center(child: Text('No contributions recorded yet.', style: TextStyle(color: Colors.grey[500])));
    }
    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.all(16),
      itemCount: _contributions.length,
      itemBuilder: (ctx, i) {
        final c = _contributions[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(c.date, style: const TextStyle(fontWeight: FontWeight.w600)),
                    _statusChip(c.status),
                  ],
                ),
                const SizedBox(height: 8),
                _detailRow('Employer', fmt.format(c.employer), color: Colors.blue),
                _detailRow('Employee', fmt.format(c.employee), color: Colors.green),
                const Divider(height: 12),
                _detailRow('Total', fmt.format(c.total), bold: true),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.w600, color: color, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _barRow(String label, double pct, Color color) {
    return Row(
      children: [
        SizedBox(width: 80, child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600]))),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: pct, backgroundColor: color.withOpacity(0.2), valueColor: AlwaysStoppedAnimation(color), minHeight: 8),
          ),
        ),
        const SizedBox(width: 8),
        Text('${(pct * 100).toStringAsFixed(1)}%', style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _actionButton(String label, Color color, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: color, padding: const EdgeInsets.symmetric(vertical: 14)),
          onPressed: onTap,
          child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    final color = status == 'active' || status == 'posted'
        ? Colors.green
        : status == 'inactive' || status == 'pending'
            ? Colors.orange
            : Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
      child: Text(status.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
    );
  }
}
