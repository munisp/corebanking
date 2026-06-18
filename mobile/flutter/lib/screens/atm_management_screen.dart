import 'package:flutter/material.dart';

class AtmManagementScreen extends StatefulWidget {
  const AtmManagementScreen({super.key});
  @override
  State<AtmManagementScreen> createState() => _AtmManagementScreenState();
}

class _AtmManagementScreenState extends State<AtmManagementScreen> {
  final List<Map<String, dynamic>> _atms = [
    {'id': 'ATM-LOS-001', 'location': 'Victoria Island Branch', 'status': 'online', 'cash': 85, 'lastReplenish': '2024-01-27'},
    {'id': 'ATM-LOS-002', 'location': 'Lekki Phase 1', 'status': 'online', 'cash': 45, 'lastReplenish': '2024-01-25'},
    {'id': 'ATM-LOS-003', 'location': 'Ikeja City Mall', 'status': 'offline', 'cash': 0, 'lastReplenish': '2024-01-20'},
    {'id': 'ATM-ABJ-001', 'location': 'Garki Area 11', 'status': 'online', 'cash': 92, 'lastReplenish': '2024-01-28'},
    {'id': 'ATM-ABJ-002', 'location': 'Wuse Zone 5', 'status': 'low_cash', 'cash': 12, 'lastReplenish': '2024-01-24'},
    {'id': 'ATM-PHC-001', 'location': 'GRA Port Harcourt', 'status': 'online', 'cash': 67, 'lastReplenish': '2024-01-26'},
  ];

  @override
  Widget build(BuildContext context) {
    int online = _atms.where((a) => a['status'] == 'online').length;
    int offline = _atms.where((a) => a['status'] == 'offline').length;
    int lowCash = _atms.where((a) => a['status'] == 'low_cash').length;
    return Scaffold(
      appBar: AppBar(title: const Text('ATM Management')),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
        Row(children: [
          Expanded(child: _statusCard('Online', '$online', Colors.green)),
          Expanded(child: _statusCard('Low Cash', '$lowCash', Colors.orange)),
          Expanded(child: _statusCard('Offline', '$offline', Colors.red)),
        ]),
        const SizedBox(height: 16),
        ...List.generate(_atms.length, (i) {
          final a = _atms[i];
          Color statusColor = a['status'] == 'online' ? Colors.green : a['status'] == 'low_cash' ? Colors.orange : Colors.red;
          return Card(child: ListTile(
            leading: CircleAvatar(backgroundColor: statusColor.withOpacity(0.2),
              child: Icon(Icons.atm, color: statusColor)),
            title: Text(a['id']),
            subtitle: Text('${a["location"]} | Cash: ${a["cash"]}%'),
            trailing: LinearProgressIndicator(value: a['cash'] / 100,
              backgroundColor: Colors.grey.shade200, color: a['cash'] < 20 ? Colors.red : Colors.green),
          ));
        }),
      ])),
    );
  }

  Widget _statusCard(String label, String value, Color color) => Card(child: Padding(
    padding: const EdgeInsets.all(12), child: Column(children: [
      Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(fontSize: 12)),
    ]),
  ));
}
