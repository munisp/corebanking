import 'package:flutter/material.dart';

/// Payment Transactions — Full transaction ledger with advanced filters and export
class PaymentTransactionsScreen extends StatefulWidget {
  const PaymentTransactionsScreen({super.key});
  @override
  State<PaymentTransactionsScreen> createState() => _PaymentTransactionsScreenState();
}

class _PaymentTransactionsScreenState extends State<PaymentTransactionsScreen> {
  String _sortBy = 'date_desc';
  RangeValues _amountRange = const RangeValues(0, 10000000);
  final _searchController = TextEditingController();
  String _typeFilter = 'all';

  final _transactions = List.generate(50, (i) => {
    'id': 'TXN-${20260609 - (i ~/ 5)}-${(i % 100).toString().padLeft(3, "0")}',
    'type': ['transfer', 'bill', 'airtime', 'pos', 'atm'][i % 5],
    'description': ['Transfer to GTBank', 'DSTV Payment', 'MTN Airtime', 'POS - ShopRite', 'ATM Withdrawal'][i % 5],
    'amount': [500000, 29500, 5000, 75000, 200000][i % 5],
    'direction': i % 3 == 0 ? 'credit' : 'debit',
    'date': '2026-06-${(9 - i ~/ 5).toString().padLeft(2, "0")}',
    'channel': ['NIP', 'Direct Debit', 'USSD', 'POS', 'ATM'][i % 5],
    'status': i == 3 ? 'failed' : i == 7 ? 'pending' : 'success',
  });

  @override
  Widget build(BuildContext context) {
    final filtered = _transactions.where((t) {
      if (_typeFilter != 'all' && t['type'] != _typeFilter) return false;
      if (_searchController.text.isNotEmpty) {
        return t['description'].toString().toLowerCase().contains(_searchController.text.toLowerCase());
      }
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transactions'),
        actions: [IconButton(icon: const Icon(Icons.download), onPressed: _exportCSV, tooltip: 'Export CSV')],
      ),
      body: Column(children: [
        // Search
        Padding(padding: const EdgeInsets.all(12), child: TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Search transactions...',
            prefixIcon: const Icon(Icons.search),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          onChanged: (_) => setState(() {}),
        )),
        // Type filter
        SizedBox(height: 36, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
          _chip('All', 'all'), _chip('Transfer', 'transfer'), _chip('Bills', 'bill'),
          _chip('Airtime', 'airtime'), _chip('POS', 'pos'), _chip('ATM', 'atm'),
        ])),
        const SizedBox(height: 8),
        // Summary bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Colors.grey.shade100,
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('${filtered.length} transactions', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            Text('Total: ₦${_sum(filtered)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          ]),
        ),
        // List
        Expanded(child: ListView.separated(
          itemCount: filtered.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (ctx, i) {
            final t = filtered[i];
            final isCredit = t['direction'] == 'credit';
            return ListTile(
              dense: true,
              leading: _channelIcon(t['channel'] as String),
              title: Text(t['description'] as String, style: const TextStyle(fontSize: 14)),
              subtitle: Text('${t["date"]} • ${t["channel"]} • ${t["id"]}', style: const TextStyle(fontSize: 11)),
              trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('${isCredit ? "+" : "-"}₦${_fmt(t["amount"] as int)}',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: isCredit ? Colors.green : Colors.black87)),
                if (t['status'] != 'success') Text(t['status'] as String, style: TextStyle(fontSize: 10,
                    color: t['status'] == 'failed' ? Colors.red : Colors.orange)),
              ]),
            );
          },
        )),
      ]),
    );
  }

  Widget _chip(String label, String value) => Padding(
    padding: const EdgeInsets.only(right: 6),
    child: FilterChip(label: Text(label, style: const TextStyle(fontSize: 12)), selected: _typeFilter == value,
        onSelected: (_) => setState(() => _typeFilter = value)),
  );

  Widget _channelIcon(String channel) {
    final icons = {'NIP': Icons.swap_horiz, 'Direct Debit': Icons.receipt, 'USSD': Icons.dialpad, 'POS': Icons.point_of_sale, 'ATM': Icons.atm};
    return CircleAvatar(radius: 16, backgroundColor: Colors.grey.shade100, child: Icon(icons[channel] ?? Icons.payment, size: 16));
  }

  String _fmt(int kobo) => (kobo ~/ 100).toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  String _sum(List<Map<String, dynamic>> txns) => _fmt(txns.fold<int>(0, (s, t) => s + (t['amount'] as int)));

  void _exportCSV() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Exporting to CSV...')));
  }
}
