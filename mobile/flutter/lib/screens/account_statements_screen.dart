import 'package:flutter/material.dart';

class AccountStatementsScreen extends StatefulWidget {
  const AccountStatementsScreen({super.key});
  @override
  State<AccountStatementsScreen> createState() => _AccountStatementsScreenState();
}

class _AccountStatementsScreenState extends State<AccountStatementsScreen> {
  String _selectedAccount = '0123456789';
  DateTimeRange? _dateRange;
  String _filterType = 'all';
  bool _isLoading = false;

  final _transactions = [
    {'date': '2024-06-08', 'desc': 'POS - Shoprite Ikeja', 'type': 'debit', 'amount': -15000, 'balance': 485000, 'ref': 'TXN-2024-10001'},
    {'date': '2024-06-07', 'desc': 'NIP Transfer - John Doe', 'type': 'debit', 'amount': -50000, 'balance': 500000, 'ref': 'TXN-2024-10000'},
    {'date': '2024-06-07', 'desc': 'Salary Credit - ABC Ltd', 'type': 'credit', 'amount': 350000, 'balance': 550000, 'ref': 'TXN-2024-09999'},
    {'date': '2024-06-06', 'desc': 'Airtime Purchase - MTN', 'type': 'debit', 'amount': -2000, 'balance': 200000, 'ref': 'TXN-2024-09998'},
    {'date': '2024-06-05', 'desc': 'Transfer from Savings', 'type': 'credit', 'amount': 100000, 'balance': 202000, 'ref': 'TXN-2024-09997'},
    {'date': '2024-06-04', 'desc': 'DSTV Subscription', 'type': 'debit', 'amount': -21000, 'balance': 102000, 'ref': 'TXN-2024-09996'},
    {'date': '2024-06-03', 'desc': 'QR Payment - Chicken Republic', 'type': 'debit', 'amount': -4500, 'balance': 123000, 'ref': 'TXN-2024-09995'},
    {'date': '2024-06-02', 'desc': 'Interest Credit', 'type': 'credit', 'amount': 1250, 'balance': 127500, 'ref': 'TXN-2024-09994'},
  ];

  List<Map<String, dynamic>> get _filteredTransactions {
    return _transactions.where((t) {
      if (_filterType == 'credit') return (t['amount'] as int) > 0;
      if (_filterType == 'debit') return (t['amount'] as int) < 0;
      return true;
    }).toList();
  }

  String _formatNGN(int amount) {
    final abs = amount.abs();
    final formatted = abs.toString().replaceAllMapped(RegExp(r"(\d)(?=(\d{3})+(?!\d))"), (m) => "${m[1]},");
    return amount < 0 ? '-NGN $formatted' : 'NGN $formatted';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Account Statements'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.download),
            onSelected: (v) => _exportStatement(v),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'pdf', child: Text('Export PDF')),
              PopupMenuItem(value: 'csv', child: Text('Export CSV')),
              PopupMenuItem(value: 'email', child: Text('Email Statement')),
            ],
          ),
        ],
      ),
      body: Column(children: [
        _buildFilters(),
        _buildSummary(),
        Expanded(child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _buildTransactionList()),
      ]),
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Column(children: [
        Row(children: [
          Expanded(child: DropdownButtonFormField<String>(
            value: _selectedAccount, isDense: true,
            decoration: const InputDecoration(labelText: 'Account', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
            items: const [
              DropdownMenuItem(value: '0123456789', child: Text('Savings - 0123456789')),
              DropdownMenuItem(value: '9876543210', child: Text('Current - 9876543210')),
            ],
            onChanged: (v) => setState(() => _selectedAccount = v!),
          )),
          const SizedBox(width: 8),
          IconButton.filled(icon: const Icon(Icons.date_range), onPressed: () async {
            final range = await showDateRangePicker(context: context,
              firstDate: DateTime(2023), lastDate: DateTime.now());
            if (range != null) setState(() => _dateRange = range);
          }),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          for (final type in [('all', 'All'), ('credit', 'Credits'), ('debit', 'Debits')])
            Padding(padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(type.$2),
                selected: _filterType == type.$1,
                onSelected: (_) => setState(() => _filterType = type.$1),
              )),
          if (_dateRange != null) Chip(
            label: Text('${_dateRange!.start.day}/${_dateRange!.start.month} - ${_dateRange!.end.day}/${_dateRange!.end.month}'),
            onDeleted: () => setState(() => _dateRange = null),
          ),
        ]),
      ]),
    );
  }

  Widget _buildSummary() {
    final credits = _filteredTransactions.where((t) => (t['amount'] as int) > 0).fold<int>(0, (s, t) => s + (t['amount'] as int));
    final debits = _filteredTransactions.where((t) => (t['amount'] as int) < 0).fold<int>(0, (s, t) => s + (t['amount'] as int));
    return Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(children: [
        Expanded(child: _summaryChip('Credits', _formatNGN(credits), Colors.green)),
        const SizedBox(width: 8),
        Expanded(child: _summaryChip('Debits', _formatNGN(debits), Colors.red)),
        const SizedBox(width: 8),
        Expanded(child: _summaryChip('Net', _formatNGN(credits + debits), Colors.blue)),
      ]),
    );
  }

  Widget _summaryChip(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), color: color.withAlpha(20)),
      child: Column(children: [
        Text(label, style: TextStyle(fontSize: 11, color: color)),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
      ]),
    );
  }

  Widget _buildTransactionList() {
    final txns = _filteredTransactions;
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: txns.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, i) {
        final t = txns[i];
        final isCredit = (t['amount'] as int) > 0;
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(
            backgroundColor: isCredit ? Colors.green.shade50 : Colors.red.shade50,
            child: Icon(isCredit ? Icons.arrow_downward : Icons.arrow_upward, color: isCredit ? Colors.green : Colors.red, size: 20),
          ),
          title: Text(t['desc'] as String, style: const TextStyle(fontSize: 14)),
          subtitle: Text('${t["date"]} • ${t["ref"]}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(_formatNGN(t['amount'] as int), style: TextStyle(fontWeight: FontWeight.bold, color: isCredit ? Colors.green : Colors.red)),
            Text('Bal: ${_formatNGN(t["balance"] as int)}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ]),
        );
      },
    );
  }

  void _exportStatement(String format) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Statement exported as ${format.toUpperCase()}'), backgroundColor: Colors.green));
  }
}
