import 'package:flutter/material.dart';

class CustomerSegmentsScreen extends StatefulWidget {
  const CustomerSegmentsScreen({super.key});
  @override
  State<CustomerSegmentsScreen> createState() => _CustomerSegmentsScreenState();
}

class _CustomerSegmentsScreenState extends State<CustomerSegmentsScreen> {
  String _selectedSegment = 'All';
  final List<Map<String, dynamic>> _segments = [
    {'name': 'High Net Worth', 'count': 12450, 'avgBalance': 45000000, 'color': Colors.purple, 'icon': Icons.diamond, 'criteria': 'Balance > ₦10M'},
    {'name': 'Mass Affluent', 'count': 67800, 'avgBalance': 5200000, 'color': Colors.blue, 'icon': Icons.trending_up, 'criteria': 'Balance ₦2M - ₦10M'},
    {'name': 'Mass Market', 'count': 345000, 'avgBalance': 450000, 'color': Colors.green, 'icon': Icons.people, 'criteria': 'Balance ₦50K - ₦2M'},
    {'name': 'Salary Earners', 'count': 189000, 'avgBalance': 1800000, 'color': Colors.orange, 'icon': Icons.work, 'criteria': 'Regular salary credits'},
    {'name': 'Students', 'count': 56000, 'avgBalance': 25000, 'color': Colors.teal, 'icon': Icons.school, 'criteria': 'Age 16-25, Tier 1'},
    {'name': 'SME', 'count': 23400, 'avgBalance': 8700000, 'color': Colors.red, 'icon': Icons.business, 'criteria': 'CAC registered, current account'},
    {'name': 'Dormant', 'count': 78900, 'avgBalance': 12000, 'color': Colors.grey, 'icon': Icons.pause_circle, 'criteria': 'No transactions > 12 months'},
    {'name': 'Agriculture', 'count': 34500, 'avgBalance': 890000, 'color': Colors.brown, 'icon': Icons.agriculture, 'criteria': 'ABP/ACGSF participants'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Segments'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: () {}, tooltip: 'Create Segment'),
      ]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.blue[50], child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Total Customers', style: TextStyle(color: Colors.grey)),
            Text('${_segments.fold<int>(0, (sum, s) => sum + (s["count"] as int)).toString().replaceAllMapped(RegExp(r"(\d{1,3})(?=(\d{3})+(?!\d))"), (m) => "${m[1]},")}',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          ])),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Active Segments', style: TextStyle(color: Colors.grey)),
            Text('${_segments.length}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          ])),
        ])),
        Expanded(child: ListView.builder(itemCount: _segments.length, itemBuilder: (ctx, i) {
          final s = _segments[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: ListTile(
            leading: CircleAvatar(backgroundColor: (s['color'] as Color).withOpacity(0.1), child: Icon(s['icon'] as IconData, color: s['color'] as Color)),
            title: Text(s['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${s["count"]} customers | Avg: ₦${((s["avgBalance"] as int) / 100).toStringAsFixed(0)} | ${s["criteria"]}'),
            trailing: PopupMenuButton(itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'view', child: Text('View Customers')),
              const PopupMenuItem(value: 'campaign', child: Text('Create Campaign')),
              const PopupMenuItem(value: 'export', child: Text('Export List')),
            ]),
          ));
        })),
      ]),
    );
  }
}
