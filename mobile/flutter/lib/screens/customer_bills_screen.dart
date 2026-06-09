import 'package:flutter/material.dart';

/// Customer Bills — Due dates, auto-pay setup, payment history
class CustomerBillsScreen extends StatefulWidget {
  const CustomerBillsScreen({super.key});
  @override
  State<CustomerBillsScreen> createState() => _CustomerBillsScreenState();
}

class _CustomerBillsScreenState extends State<CustomerBillsScreen> {
  final _bills = [
    {'id': 'BILL-001', 'biller': 'EKEDC', 'type': 'Electricity', 'amount': 15000, 'due': '2026-06-15', 'status': 'due', 'autopay': true, 'icon': Icons.bolt},
    {'id': 'BILL-002', 'biller': 'DSTV', 'type': 'Cable TV', 'amount': 29500, 'due': '2026-06-20', 'status': 'due', 'autopay': false, 'icon': Icons.tv},
    {'id': 'BILL-003', 'biller': 'Spectranet', 'type': 'Internet', 'amount': 12000, 'due': '2026-06-10', 'status': 'overdue', 'autopay': false, 'icon': Icons.wifi},
    {'id': 'BILL-004', 'biller': 'Lagos Water', 'type': 'Water', 'amount': 5500, 'due': '2026-06-25', 'status': 'upcoming', 'autopay': true, 'icon': Icons.water_drop},
    {'id': 'BILL-005', 'biller': 'MTN', 'type': 'Phone', 'amount': 3000, 'due': '2026-06-12', 'status': 'paid', 'autopay': true, 'icon': Icons.phone_android},
  ];

  @override
  Widget build(BuildContext context) {
    final overdue = _bills.where((b) => b['status'] == 'overdue').toList();
    final due = _bills.where((b) => b['status'] == 'due').toList();
    final upcoming = _bills.where((b) => b['status'] == 'upcoming').toList();
    final paid = _bills.where((b) => b['status'] == 'paid').toList();

    return Scaffold(
      appBar: AppBar(title: const Text('My Bills'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: _addBiller),
      ]),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Summary card
          Card(
            color: Colors.green.shade50,
            child: Padding(padding: const EdgeInsets.all(16), child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _summaryItem('Due', '₦${_sumBills(due)}', Colors.orange),
                _summaryItem('Overdue', '₦${_sumBills(overdue)}', Colors.red),
                _summaryItem('Auto-Pay', '${_bills.where((b) => b["autopay"] == true).length}', Colors.green),
              ],
            )),
          ),
          const SizedBox(height: 16),
          // Overdue
          if (overdue.isNotEmpty) ...[
            _sectionHeader('Overdue', Colors.red),
            ...overdue.map(_buildBillTile),
          ],
          // Due
          if (due.isNotEmpty) ...[
            _sectionHeader('Due Soon', Colors.orange),
            ...due.map(_buildBillTile),
          ],
          // Upcoming
          if (upcoming.isNotEmpty) ...[
            _sectionHeader('Upcoming', Colors.blue),
            ...upcoming.map(_buildBillTile),
          ],
          // Paid
          if (paid.isNotEmpty) ...[
            _sectionHeader('Paid', Colors.green),
            ...paid.map(_buildBillTile),
          ],
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, Color color) => Padding(
    padding: const EdgeInsets.only(top: 16, bottom: 8),
    child: Row(children: [Container(width: 4, height: 20, color: color), const SizedBox(width: 8), Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color))]),
  );

  Widget _buildBillTile(Map<String, dynamic> bill) {
    final isPaid = bill['status'] == 'paid';
    final isOverdue = bill['status'] == 'overdue';
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isPaid ? Colors.green.shade50 : isOverdue ? Colors.red.shade50 : Colors.grey.shade100,
          child: Icon(bill['icon'] as IconData, color: isPaid ? Colors.green : isOverdue ? Colors.red : Colors.grey.shade600),
        ),
        title: Text(bill['biller'] as String),
        subtitle: Row(children: [
          Text('Due: ${bill["due"]}'),
          if (bill['autopay'] == true) ...[const SizedBox(width: 8), const Icon(Icons.autorenew, size: 14, color: Colors.green), const Text(' Auto', style: TextStyle(fontSize: 11, color: Colors.green))],
        ]),
        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('₦${(bill["amount"] as int).toString().replaceAllMapped(RegExp(r"(\d{1,3})(?=(\d{3})+(?!\d))"), (m) => "${m[1]},")}',
              style: TextStyle(fontWeight: FontWeight.bold, color: isOverdue ? Colors.red : null)),
          if (!isPaid) TextButton(onPressed: () {}, style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(50, 20)),
              child: const Text('Pay', style: TextStyle(fontSize: 12))),
        ]),
        onTap: () => _showBillDetail(bill),
        onLongPress: () => _toggleAutoPay(bill),
      ),
    );
  }

  Widget _summaryItem(String label, String value, Color color) => Column(children: [
    Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color)),
    Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
  ]);

  String _sumBills(List<Map<String, dynamic>> bills) {
    final total = bills.fold<int>(0, (sum, b) => sum + (b['amount'] as int));
    return total.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  void _showBillDetail(Map<String, dynamic> bill) {
    showModalBottomSheet(context: context, builder: (ctx) => Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(bill['biller'] as String, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Text('Type: ${bill["type"]}'),
        Text('Amount: ₦${bill["amount"]}'),
        Text('Due Date: ${bill["due"]}'),
        Text('Auto-Pay: ${bill["autopay"] == true ? "Enabled" : "Disabled"}'),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))),
          const SizedBox(width: 12),
          Expanded(child: ElevatedButton(onPressed: () { Navigator.pop(ctx); }, child: const Text('Pay Now'))),
        ]),
      ]),
    ));
  }

  void _toggleAutoPay(Map<String, dynamic> bill) {
    setState(() => bill['autopay'] = !(bill['autopay'] as bool));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('Auto-pay ${bill["autopay"] == true ? "enabled" : "disabled"} for ${bill["biller"]}'),
    ));
  }

  void _addBiller() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Add biller coming soon')));
  }
}
