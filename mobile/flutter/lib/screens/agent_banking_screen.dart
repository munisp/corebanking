import 'package:flutter/material.dart';

/// Agent Banking — POS agent management, commission tracking, float management
class AgentBankingScreen extends StatefulWidget {
  const AgentBankingScreen({super.key});
  @override
  State<AgentBankingScreen> createState() => _AgentBankingScreenState();
}

class _AgentBankingScreenState extends State<AgentBankingScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final _todayStats = {'transactions': 145, 'volume': 8750000, 'commission': 43750, 'float': 2500000};
  final _recentTxns = [
    {'type': 'Cash In', 'amount': 50000, 'commission': 250, 'time': '14:30', 'customer': '+234801...678'},
    {'type': 'Cash Out', 'amount': 200000, 'commission': 1000, 'time': '14:15', 'customer': '+234809...432'},
    {'type': 'Transfer', 'amount': 100000, 'commission': 500, 'time': '13:45', 'customer': '+234701...123'},
    {'type': 'Bill Pay', 'amount': 29500, 'commission': 150, 'time': '13:20', 'customer': '+234812...890'},
    {'type': 'Airtime', 'amount': 5000, 'commission': 200, 'time': '12:50', 'customer': '+234905...567'},
  ];

  @override
  void initState() { super.initState(); _tabController = TabController(length: 3, vsync: this); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agent Banking'), bottom: TabBar(controller: _tabController, tabs: const [
        Tab(text: 'Dashboard'), Tab(text: 'Float'), Tab(text: 'Commission'),
      ])),
      body: TabBarView(controller: _tabController, children: [_dashboard(), _float(), _commission()]),
    );
  }

  Widget _dashboard() => ListView(padding: const EdgeInsets.all(16), children: [
    // Stats grid
    Row(children: [
      _stat('Transactions', '${_todayStats["transactions"]}', Icons.receipt),
      _stat('Volume', '₦${(_todayStats["volume"]! ~/ 1000000)}M', Icons.trending_up),
    ]),
    Row(children: [
      _stat('Commission', '₦${_todayStats["commission"]! ~/ 100}', Icons.monetization_on),
      _stat('Float', '₦${(_todayStats["float"]! ~/ 1000000)}M', Icons.account_balance_wallet),
    ]),
    const SizedBox(height: 16),
    // Quick actions
    const Text('Quick Actions', style: TextStyle(fontWeight: FontWeight.bold)),
    const SizedBox(height: 8),
    Row(children: [
      _action(Icons.add_circle, 'Cash In', Colors.green),
      _action(Icons.remove_circle, 'Cash Out', Colors.red),
      _action(Icons.send, 'Transfer', Colors.blue),
      _action(Icons.person_add, 'New A/C', Colors.purple),
    ].map((w) => Expanded(child: w)).toList()),
    const SizedBox(height: 16),
    // Recent transactions
    const Text('Recent Transactions', style: TextStyle(fontWeight: FontWeight.bold)),
    ..._recentTxns.map((t) => ListTile(dense: true,
      leading: Icon(t['type'] == 'Cash In' ? Icons.arrow_downward : Icons.arrow_upward, color: t['type'] == 'Cash In' ? Colors.green : Colors.red),
      title: Text('${t["type"]} - ₦${t["amount"]}'),
      subtitle: Text('${t["customer"]} • ${t["time"]}'),
      trailing: Text('+₦${t["commission"]}', style: const TextStyle(color: Colors.green, fontSize: 12)),
    )),
  ]);

  Widget _float() => ListView(padding: const EdgeInsets.all(16), children: [
    Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
      const Text('Available Float', style: TextStyle(color: Colors.grey)),
      const SizedBox(height: 8),
      const Text('₦2,500,000', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
      const SizedBox(height: 4),
      LinearProgressIndicator(value: 0.5, backgroundColor: Colors.grey.shade200),
      const SizedBox(height: 4),
      const Text('50% of ₦5,000,000 limit', style: TextStyle(fontSize: 12, color: Colors.grey)),
    ]))),
    const SizedBox(height: 16),
    ElevatedButton.icon(icon: const Icon(Icons.add), label: const Text('Top Up Float'), onPressed: () {}),
    const SizedBox(height: 8),
    OutlinedButton.icon(icon: const Icon(Icons.history), label: const Text('Float History'), onPressed: () {}),
  ]);

  Widget _commission() => ListView(padding: const EdgeInsets.all(16), children: [
    Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
      const Text('This Month', style: TextStyle(color: Colors.grey)),
      const Text('₦875,000', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.green)),
      const Text('from 3,245 transactions', style: TextStyle(fontSize: 12, color: Colors.grey)),
    ]))),
    const SizedBox(height: 16),
    const Text('Commission Structure', style: TextStyle(fontWeight: FontWeight.bold)),
    _commRow('Cash In (up to ₦5K)', '₦50'),
    _commRow('Cash In (₦5K - ₦50K)', '₦100-₦250'),
    _commRow('Cash Out', '0.5% (max ₦2,000)'),
    _commRow('Transfer', '₦500 flat'),
    _commRow('Bill Payment', '₦100-₦200'),
    _commRow('Airtime', '4% of value'),
  ]);

  Widget _stat(String label, String value, IconData icon) => Expanded(child: Card(child: Padding(
    padding: const EdgeInsets.all(12), child: Row(children: [Icon(icon, color: Colors.green), const SizedBox(width: 8),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)), Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey))])]))));

  Widget _action(IconData icon, String label, Color color) => InkWell(onTap: () {},
    child: Padding(padding: const EdgeInsets.all(8), child: Column(children: [
      Container(width: 48, height: 48, decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: color)),
      const SizedBox(height: 4), Text(label, style: const TextStyle(fontSize: 10)),
    ])));

  Widget _commRow(String desc, String rate) => Padding(padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(desc), Text(rate, style: const TextStyle(fontWeight: FontWeight.bold))]));
}
