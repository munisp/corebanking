import 'package:flutter/material.dart';

class LoanAccountsScreen extends StatefulWidget {
  const LoanAccountsScreen({super.key});
  @override
  State<LoanAccountsScreen> createState() => _LoanAccountsScreenState();
}

class _LoanAccountsScreenState extends State<LoanAccountsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, dynamic>> _activeLoans = [
    {'id': 'LN-2024-001', 'type': 'Personal', 'principal': 2000000, 'outstanding': 1450000, 'rate': 18.5, 'nextDue': '2024-02-15', 'status': 'current'},
    {'id': 'LN-2024-002', 'type': 'Auto', 'principal': 8500000, 'outstanding': 7200000, 'rate': 14.0, 'nextDue': '2024-02-28', 'status': 'current'},
    {'id': 'LN-2023-015', 'type': 'Mortgage', 'principal': 35000000, 'outstanding': 32100000, 'rate': 12.5, 'nextDue': '2024-02-01', 'status': 'overdue'},
  ];

  final List<Map<String, dynamic>> _closedLoans = [
    {'id': 'LN-2022-008', 'type': 'Personal', 'principal': 500000, 'paidDate': '2023-06-15', 'totalPaid': 612500},
    {'id': 'LN-2021-003', 'type': 'SME', 'principal': 5000000, 'paidDate': '2023-12-01', 'totalPaid': 6250000},
  ];

  @override
  void initState() { super.initState(); _tabController = TabController(length: 2, vsync: this); }
  @override
  void dispose() { _tabController.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Loan Accounts'),
        bottom: TabBar(controller: _tabController, tabs: const [Tab(text: 'Active'), Tab(text: 'Closed')]),
      ),
      body: TabBarView(controller: _tabController, children: [
        _buildActiveLoans(),
        _buildClosedLoans(),
      ]),
    );
  }

  Widget _buildActiveLoans() => ListView.builder(
    padding: const EdgeInsets.all(16),
    itemCount: _activeLoans.length,
    itemBuilder: (ctx, i) {
      final loan = _activeLoans[i];
      double progress = 1 - (loan['outstanding'] / loan['principal']);
      return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text(loan['id'], style: const TextStyle(fontWeight: FontWeight.bold)),
            const Spacer(),
            Chip(label: Text(loan['status'], style: const TextStyle(fontSize: 11)),
              backgroundColor: loan['status'] == 'overdue' ? Colors.red.shade100 : Colors.green.shade100),
          ]),
          const SizedBox(height: 8),
          Text('${loan["type"]} Loan @ ${loan["rate"]}% p.a.'),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: progress, backgroundColor: Colors.grey.shade200),
          const SizedBox(height: 4),
          Row(children: [
            Text('\u20A6${(loan["outstanding"] / 100).toStringAsFixed(0)} remaining'),
            const Spacer(),
            Text('${(progress * 100).toStringAsFixed(0)}% repaid'),
          ]),
          const SizedBox(height: 8),
          Text('Next due: ${loan["nextDue"]}', style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 8),
          Row(children: [
            ElevatedButton(onPressed: () {}, child: const Text('Pay Now')),
            const SizedBox(width: 8),
            OutlinedButton(onPressed: () {}, child: const Text('Schedule')),
          ]),
        ],
      )));
    },
  );

  Widget _buildClosedLoans() => ListView.builder(
    padding: const EdgeInsets.all(16),
    itemCount: _closedLoans.length,
    itemBuilder: (ctx, i) {
      final loan = _closedLoans[i];
      return Card(child: ListTile(
        leading: const CircleAvatar(backgroundColor: Colors.green, child: Icon(Icons.check, color: Colors.white)),
        title: Text('${loan["id"]} - ${loan["type"]}'),
        subtitle: Text('Closed ${loan["paidDate"]} | Total paid: \u20A6${(loan["totalPaid"] / 100).toStringAsFixed(0)}'),
      ));
    },
  );
}
