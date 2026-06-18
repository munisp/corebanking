import 'package:flutter/material.dart';

class ApisixRoutesScreen extends StatefulWidget {
  const ApisixRoutesScreen({super.key});
  @override
  State<ApisixRoutesScreen> createState() => _ApisixRoutesScreenState();
}

class _ApisixRoutesScreenState extends State<ApisixRoutesScreen> {
  final List<Map<String, dynamic>> _routes = [
    {'uri': '/api/v1/accounts/*', 'upstream': 'account-service', 'methods': 'GET,POST,PUT', 'rps': 2400, 'status': 'Active'},
    {'uri': '/api/v1/transfers/*', 'upstream': 'transfer-service', 'methods': 'POST', 'rps': 1800, 'status': 'Active'},
    {'uri': '/api/v1/cards/*', 'upstream': 'card-service', 'methods': 'GET,POST,PUT', 'rps': 950, 'status': 'Active'},
    {'uri': '/api/v1/loans/*', 'upstream': 'loan-service', 'methods': 'GET,POST', 'rps': 450, 'status': 'Active'},
    {'uri': '/api/v1/kyc/*', 'upstream': 'kyc-service', 'methods': 'POST', 'rps': 320, 'status': 'Active'},
    {'uri': '/api/v1/payments/*', 'upstream': 'payment-service', 'methods': 'POST', 'rps': 3200, 'status': 'Active'},
    {'uri': '/api/v1/auth/*', 'upstream': 'auth-service', 'methods': 'POST', 'rps': 5600, 'status': 'Active'},
    {'uri': '/api/v1/admin/*', 'upstream': 'admin-service', 'methods': 'ALL', 'rps': 120, 'status': 'Rate Limited'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('APISIX Routes'), actions: [
        IconButton(icon: const Icon(Icons.add), onPressed: () {}, tooltip: 'Add Route'),
      ]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(12), color: Colors.blue[50], child: Row(children: [
          Expanded(child: _stat('Routes', '${_routes.length}', Colors.blue)),
          Expanded(child: _stat('Total RPS', '${_routes.fold<int>(0, (s, r) => s + (r["rps"] as int))}', Colors.green)),
          Expanded(child: _stat('Active', '${_routes.where((r) => r["status"] == "Active").length}', Colors.green)),
        ])),
        Expanded(child: ListView.builder(itemCount: _routes.length, itemBuilder: (ctx, i) {
          final r = _routes[i];
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: ListTile(
            leading: const Icon(Icons.alt_route, color: Colors.blue),
            title: Text(r['uri'] as String, style: const TextStyle(fontFamily: 'monospace')),
            subtitle: Text('→ ${r["upstream"]} | ${r["methods"]} | ${r["rps"]} rps'),
            trailing: Chip(label: Text(r['status'] as String, style: const TextStyle(fontSize: 10)),
              backgroundColor: r['status'] == 'Active' ? Colors.green[100] : Colors.orange[100]),
          ));
        })),
      ]),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Column(children: [Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)), Text(label, style: const TextStyle(fontSize: 11))]);
  }
}
