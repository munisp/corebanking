import 'package:flutter/material.dart';

class ChequeClearingScreen extends StatefulWidget {
  const ChequeClearingScreen({super.key});
  @override
  State<ChequeClearingScreen> createState() => _ChequeClearingScreenState();
}

class _ChequeClearingScreenState extends State<ChequeClearingScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<Map<String, dynamic>> _cheques = [
    {'number': 'CHQ-00456789', 'drawer': 'Adebayo Corp', 'bank': 'First Bank', 'amount': 2500000, 'status': 'In Clearing', 'date': '2024-01-15', 'clearDate': '2024-01-17'},
    {'number': 'CHQ-00456790', 'drawer': 'Okafor & Sons', 'bank': 'GTBank', 'amount': 850000, 'status': 'Cleared', 'date': '2024-01-14', 'clearDate': '2024-01-16'},
    {'number': 'CHQ-00456791', 'drawer': 'Nwankwo Trading', 'bank': 'Zenith Bank', 'amount': 15000000, 'status': 'Returned', 'date': '2024-01-13', 'clearDate': '-'},
    {'number': 'CHQ-00456792', 'drawer': 'Abdullahi Farms', 'bank': 'Access Bank', 'amount': 450000, 'status': 'In Clearing', 'date': '2024-01-15', 'clearDate': '2024-01-17'},
    {'number': 'CHQ-00456793', 'drawer': 'Lagos State Govt', 'bank': 'CBN', 'amount': 50000000, 'status': 'Cleared', 'date': '2024-01-12', 'clearDate': '2024-01-14'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cheque Clearing'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'Inward'), Tab(text: 'Outward'), Tab(text: 'Returns'),
        ])),
      body: TabBarView(controller: _tabController, children: [
        _buildChequeList(_cheques),
        _buildChequeList(_cheques.reversed.toList()),
        _buildChequeList(_cheques.where((c) => c['status'] == 'Returned').toList()),
      ]),
    );
  }

  Widget _buildChequeList(List<Map<String, dynamic>> cheques) {
    return Column(children: [
      Container(padding: const EdgeInsets.all(12), color: Colors.orange[50], child: Row(children: [
        Expanded(child: _stat('Total', '${cheques.length}', Colors.blue)),
        Expanded(child: _stat('Clearing', '${cheques.where((c) => c["status"] == "In Clearing").length}', Colors.orange)),
        Expanded(child: _stat('Cleared', '${cheques.where((c) => c["status"] == "Cleared").length}', Colors.green)),
        Expanded(child: _stat('Returned', '${cheques.where((c) => c["status"] == "Returned").length}', Colors.red)),
      ])),
      Expanded(child: ListView.builder(itemCount: cheques.length, itemBuilder: (ctx, i) {
        final c = cheques[i];
        final color = c['status'] == 'Cleared' ? Colors.green : c['status'] == 'Returned' ? Colors.red : Colors.orange;
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: ListTile(
          leading: Icon(Icons.receipt, color: color),
          title: Text('${c["number"]} - ${c["drawer"]}'), subtitle: Text('${c["bank"]} | Deposited: ${c["date"]} | Clear by: ${c["clearDate"]}'),
          trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('₦${((c["amount"] as int) / 100).toStringAsFixed(0)}', style: TextStyle(fontWeight: FontWeight.bold, color: color)),
            Text(c['status'] as String, style: TextStyle(fontSize: 11, color: color)),
          ]),
        ));
      })),
    ]);
  }

  Widget _stat(String label, String value, Color color) {
    return Column(children: [Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11))]);
  }
}
