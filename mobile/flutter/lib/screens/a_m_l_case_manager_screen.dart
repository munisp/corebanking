import 'package:flutter/material.dart';

class AMLCaseManagerScreen extends StatefulWidget {
  const AMLCaseManagerScreen({super.key});
  @override
  State<AMLCaseManagerScreen> createState() => _AMLCaseManagerScreenState();
}

class _AMLCaseManagerScreenState extends State<AMLCaseManagerScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, dynamic>> _cases = [
    {'id': 'AML-2024-0891', 'customer': 'ABCDEF Holdings Ltd', 'type': 'Structuring', 'amount': 49500000, 'status': 'investigating', 'priority': 'high', 'assignee': 'Compliance Officer A', 'daysOpen': 3},
    {'id': 'AML-2024-0890', 'customer': 'John Doe', 'type': 'PEP Transaction', 'amount': 125000000, 'status': 'escalated', 'priority': 'critical', 'assignee': 'MLRO', 'daysOpen': 7},
    {'id': 'AML-2024-0889', 'customer': 'XYZ Imports', 'type': 'Round-tripping', 'amount': 89000000, 'status': 'investigating', 'priority': 'medium', 'assignee': 'Compliance Officer B', 'daysOpen': 5},
    {'id': 'AML-2024-0888', 'customer': 'Jane Smith', 'type': 'Unusual Geography', 'amount': 15000000, 'status': 'filed_str', 'priority': 'high', 'assignee': 'Compliance Officer A', 'daysOpen': 12},
    {'id': 'AML-2024-0885', 'customer': 'Acme Corp', 'type': 'Layering', 'amount': 230000000, 'status': 'closed_no_action', 'priority': 'low', 'assignee': 'Compliance Officer C', 'daysOpen': 20},
  ];

  @override
  void initState() { super.initState(); _tabController = TabController(length: 3, vsync: this); }
  @override
  void dispose() { _tabController.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AML Case Manager'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'Active'), Tab(text: 'Escalated'), Tab(text: 'Closed'),
        ]),
      ),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add)),
      body: TabBarView(controller: _tabController, children: [
        _buildCaseList(_cases.where((c) => c['status'] == 'investigating').toList()),
        _buildCaseList(_cases.where((c) => c['status'] == 'escalated' || c['status'] == 'filed_str').toList()),
        _buildCaseList(_cases.where((c) => c['status'].startsWith('closed')).toList()),
      ]),
    );
  }

  Widget _buildCaseList(List<Map<String, dynamic>> cases) => ListView.builder(
    padding: const EdgeInsets.all(16),
    itemCount: cases.length,
    itemBuilder: (ctx, i) {
      final c = cases[i];
      Color prioColor = c['priority'] == 'critical' ? Colors.red : c['priority'] == 'high' ? Colors.orange : Colors.blue;
      return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(width: 4, height: 40, color: prioColor),
            const SizedBox(width: 8),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c['id'], style: const TextStyle(fontWeight: FontWeight.bold)),
              Text(c['customer'], style: const TextStyle(fontSize: 15)),
            ])),
            Chip(label: Text(c['priority'].toUpperCase(), style: TextStyle(color: prioColor, fontSize: 10)),
              backgroundColor: prioColor.withOpacity(0.1)),
          ]),
          const Divider(),
          Row(children: [
            Text('Type: ${c["type"]}'),
            const Spacer(),
            Text('\u20A6${(c["amount"] / 100).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w500)),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            Text('Assigned: ${c["assignee"]}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
            const Spacer(),
            Text('${c["daysOpen"]}d open', style: TextStyle(
              color: c['daysOpen'] > 10 ? Colors.red : Colors.grey, fontSize: 12)),
          ]),
        ],
      )));
    },
  );
}
