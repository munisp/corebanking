import 'package:flutter/material.dart';

class ApprovalWorkflowScreen extends StatefulWidget {
  const ApprovalWorkflowScreen({super.key});
  @override
  State<ApprovalWorkflowScreen> createState() => _ApprovalWorkflowScreenState();
}

class _ApprovalWorkflowScreenState extends State<ApprovalWorkflowScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Map<String, dynamic>> _pending = [
    {'id': 'APR-001', 'type': 'Transfer', 'amount': 15000000, 'initiator': 'Ops Officer A', 'time': '10 min ago', 'priority': 'high'},
    {'id': 'APR-002', 'type': 'Account Opening', 'amount': 0, 'initiator': 'CSO B', 'time': '25 min ago', 'priority': 'normal'},
    {'id': 'APR-003', 'type': 'Loan Disbursement', 'amount': 5000000, 'initiator': 'Credit Officer', 'time': '1 hour ago', 'priority': 'high'},
    {'id': 'APR-004', 'type': 'Fee Waiver', 'amount': 50000, 'initiator': 'Branch Manager', 'time': '2 hours ago', 'priority': 'low'},
  ];

  @override
  void initState() { super.initState(); _tabController = TabController(length: 3, vsync: this); }
  @override
  void dispose() { _tabController.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Approval Workflow'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'Pending (4)'), Tab(text: 'Approved'), Tab(text: 'Rejected'),
        ]),
      ),
      body: TabBarView(controller: _tabController, children: [
        _buildPendingList(),
        const Center(child: Text('No recent approvals')),
        const Center(child: Text('No recent rejections')),
      ]),
    );
  }

  Widget _buildPendingList() => ListView.builder(
    padding: const EdgeInsets.all(16),
    itemCount: _pending.length,
    itemBuilder: (ctx, i) {
      final p = _pending[i];
      return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text(p['id'], style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(width: 8),
            Chip(label: Text(p['type'], style: const TextStyle(fontSize: 11))),
            const Spacer(),
            if (p['priority'] == 'high') const Icon(Icons.priority_high, color: Colors.red, size: 18),
          ]),
          const SizedBox(height: 8),
          if (p['amount'] > 0) Text('Amount: \u20A6${(p["amount"] / 100).toStringAsFixed(0)}'),
          Text('By: ${p["initiator"]} | ${p["time"]}', style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: ElevatedButton(onPressed: () => _approve(i), style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
              child: const Text('Approve', style: TextStyle(color: Colors.white)))),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton(onPressed: () => _reject(i), style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              child: const Text('Reject'))),
          ]),
        ],
      )));
    },
  );

  void _approve(int i) => setState(() { _pending.removeAt(i); });
  void _reject(int i) => setState(() { _pending.removeAt(i); });
}
