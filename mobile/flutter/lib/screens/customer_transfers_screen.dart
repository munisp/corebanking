import 'package:flutter/material.dart';

/// Transfer History — filterable transaction log with receipts and dispute filing
class CustomerTransfersScreen extends StatefulWidget {
  const CustomerTransfersScreen({super.key});
  @override
  State<CustomerTransfersScreen> createState() => _CustomerTransfersScreenState();
}

class _CustomerTransfersScreenState extends State<CustomerTransfersScreen> {
  String _filter = 'all'; // all, sent, received, pending, failed
  String _dateRange = '7d'; // 7d, 30d, 90d, custom
  final _searchController = TextEditingController();
  bool _isLoading = false;

  final _transactions = [
    {'id': 'TXN-20260609-001', 'type': 'sent', 'to': 'John Doe - GTBank 0123456789', 'amount': 250000, 'status': 'completed', 'date': '2026-06-09 14:30', 'ref': 'NIP/54B/20260609/001'},
    {'id': 'TXN-20260609-002', 'type': 'received', 'from': 'Jane Smith - UBA 9876543210', 'amount': 1500000, 'status': 'completed', 'date': '2026-06-09 10:15', 'ref': 'NIP/UBA/20260609/045'},
    {'id': 'TXN-20260608-001', 'type': 'sent', 'to': 'DSTV - Multichoice', 'amount': 29500, 'status': 'completed', 'date': '2026-06-08 09:00', 'ref': 'BILL/54B/20260608/001'},
    {'id': 'TXN-20260607-001', 'type': 'sent', 'to': 'MTN Nigeria', 'amount': 5000, 'status': 'failed', 'date': '2026-06-07 18:45', 'ref': 'VAS/54B/20260607/001'},
    {'id': 'TXN-20260607-002', 'type': 'sent', 'to': 'Beneficiary - Zenith 2345678901', 'amount': 5000000, 'status': 'pending', 'date': '2026-06-07 16:30', 'ref': 'NIP/54B/20260607/002'},
  ];

  List<Map<String, dynamic>> get _filteredTransactions {
    return _transactions.where((t) {
      if (_filter != 'all' && t['type'] != _filter && t['status'] != _filter) return false;
      if (_searchController.text.isNotEmpty) {
        final q = _searchController.text.toLowerCase();
        return (t['to'] ?? t['from'] ?? '').toString().toLowerCase().contains(q) ||
            t['ref'].toString().toLowerCase().contains(q);
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Transfer History')),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by name, account, or reference...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                suffixIcon: IconButton(icon: const Icon(Icons.tune), onPressed: _showFilterSheet),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          // Filter chips
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _filterChip('All', 'all'),
                _filterChip('Sent', 'sent'),
                _filterChip('Received', 'received'),
                _filterChip('Pending', 'pending'),
                _filterChip('Failed', 'failed'),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Transaction list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    itemCount: _filteredTransactions.length,
                    itemBuilder: (ctx, i) => _buildTransactionTile(_filteredTransactions[i]),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: _filter == value,
        onSelected: (_) => setState(() => _filter = value),
      ),
    );
  }

  Widget _buildTransactionTile(Map<String, dynamic> txn) {
    final isSent = txn['type'] == 'sent';
    final amount = txn['amount'] as int;
    final status = txn['status'] as String;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: isSent ? Colors.red.shade50 : Colors.green.shade50,
        child: Icon(isSent ? Icons.arrow_upward : Icons.arrow_downward,
            color: isSent ? Colors.red : Colors.green),
      ),
      title: Text(isSent ? (txn['to'] as String) : (txn['from'] as String)),
      subtitle: Text('${txn['date']} • ${txn['ref']}'),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text('${isSent ? "-" : "+"}₦${_formatAmount(amount)}',
              style: TextStyle(fontWeight: FontWeight.bold, color: isSent ? Colors.red : Colors.green)),
          _statusBadge(status),
        ],
      ),
      onTap: () => _showReceiptSheet(txn),
    );
  }

  Widget _statusBadge(String status) {
    final colors = {'completed': Colors.green, 'pending': Colors.orange, 'failed': Colors.red};
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: (colors[status] ?? Colors.grey).withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(status.toUpperCase(), style: TextStyle(fontSize: 10, color: colors[status])),
    );
  }

  String _formatAmount(int kobo) {
    final naira = kobo ~/ 100;
    return naira.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  void _showFilterSheet() {
    showModalBottomSheet(context: context, builder: (ctx) => Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Date Range', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Wrap(spacing: 8, children: [
            ChoiceChip(label: const Text('7 days'), selected: _dateRange == '7d', onSelected: (_) => setState(() { _dateRange = '7d'; Navigator.pop(ctx); })),
            ChoiceChip(label: const Text('30 days'), selected: _dateRange == '30d', onSelected: (_) => setState(() { _dateRange = '30d'; Navigator.pop(ctx); })),
            ChoiceChip(label: const Text('90 days'), selected: _dateRange == '90d', onSelected: (_) => setState(() { _dateRange = '90d'; Navigator.pop(ctx); })),
          ]),
        ],
      ),
    ));
  }

  void _showReceiptSheet(Map<String, dynamic> txn) {
    showModalBottomSheet(context: context, isScrollControlled: true, builder: (ctx) => DraggableScrollableSheet(
      initialChildSize: 0.7, minChildSize: 0.5, maxChildSize: 0.9,
      builder: (_, scrollCtrl) => Container(
        padding: const EdgeInsets.all(24),
        child: ListView(controller: scrollCtrl, children: [
          const Center(child: Text('Transaction Receipt', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold))),
          const SizedBox(height: 24),
          _receiptRow('Reference', txn['ref']),
          _receiptRow('Amount', '₦${_formatAmount(txn['amount'])}'),
          _receiptRow('Status', txn['status']),
          _receiptRow('Date', txn['date']),
          _receiptRow('Recipient', txn['to'] ?? txn['from'] ?? ''),
          const SizedBox(height: 24),
          if (txn['status'] == 'failed') ElevatedButton.icon(
            icon: const Icon(Icons.report_problem),
            label: const Text('File Dispute'),
            onPressed: () {},
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(icon: const Icon(Icons.share), label: const Text('Share Receipt'), onPressed: () {}),
        ]),
      ),
    ));
  }

  Widget _receiptRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: Colors.grey)),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
    ]),
  );
}
