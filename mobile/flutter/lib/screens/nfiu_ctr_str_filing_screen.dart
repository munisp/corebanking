import 'package:flutter/material.dart';

class NfiuCtrStrFilingScreen extends StatefulWidget {
  const NfiuCtrStrFilingScreen({super.key});
  @override
  State<NfiuCtrStrFilingScreen> createState() => _NfiuCtrStrFilingScreenState();
}

class _NfiuCtrStrFilingScreenState extends State<NfiuCtrStrFilingScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, String>> _ctrs = [
    {'ref': 'CTR-2024-0015', 'customer': 'Adebayo Trading', 'amount': '₦8,500,000', 'type': 'Cash Deposit', 'date': '2024-01-15', 'status': 'Filed'},
    {'ref': 'CTR-2024-0014', 'customer': 'Okafor Enterprises', 'amount': '₦12,000,000', 'type': 'Cash Withdrawal', 'date': '2024-01-14', 'status': 'Filed'},
    {'ref': 'CTR-2024-0013', 'customer': 'Nwankwo & Sons', 'amount': '₦6,200,000', 'type': 'Cash Deposit', 'date': '2024-01-13', 'status': 'Pending'},
  ];

  final List<Map<String, String>> _strs = [
    {'ref': 'STR-2024-0005', 'customer': 'Unknown Entity', 'reason': 'Structuring - multiple deposits below threshold', 'date': '2024-01-15', 'status': 'Filed', 'sla': '24h'},
    {'ref': 'STR-2024-0004', 'customer': 'Shell Company Ltd', 'reason': 'Unusual pattern - rapid fund movement', 'date': '2024-01-12', 'status': 'Under Review', 'sla': '48h'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('NFIU CTR/STR Filing'), backgroundColor: Colors.red[900],
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'CTR (≥₦5M Cash)'), Tab(text: 'STR (Suspicious)'),
        ])),
      body: TabBarView(controller: _tabController, children: [
        ListView.builder(itemCount: _ctrs.length, itemBuilder: (ctx, i) {
          final c = _ctrs[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
            leading: const Icon(Icons.monetization_on, color: Colors.orange),
            title: Text('${c["ref"]} - ${c["customer"]}'), subtitle: Text('${c["type"]} | ${c["amount"]} | ${c["date"]}'),
            trailing: Chip(label: Text(c['status']!), backgroundColor: c['status'] == 'Filed' ? Colors.green[100] : Colors.orange[100]),
          ));
        }),
        ListView.builder(itemCount: _strs.length, itemBuilder: (ctx, i) {
          final s = _strs[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ExpansionTile(
            leading: const Icon(Icons.report_problem, color: Colors.red),
            title: Text('${s["ref"]} - ${s["customer"]}'), subtitle: Text('SLA: ${s["sla"]} | ${s["date"]}'),
            children: [Padding(padding: const EdgeInsets.all(16), child: Text('Reason: ${s["reason"]}'))],
          ));
        }),
      ]),
    );
  }
}
