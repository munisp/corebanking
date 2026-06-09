import 'package:flutter/material.dart';

class ServiceCatalogScreen extends StatefulWidget {
  const ServiceCatalogScreen({super.key});
  @override
  State<ServiceCatalogScreen> createState() => _ServiceCatalogScreenState();
}

class _ServiceCatalogScreenState extends State<ServiceCatalogScreen> {
  String _filter = 'All';
  final List<Map<String, dynamic>> _services = [
    {'name': 'Account Service', 'lang': 'Go', 'port': 9001, 'status': 'Healthy', 'cpu': 12, 'mem': 256, 'replicas': 3},
    {'name': 'Transfer Service', 'lang': 'Go', 'port': 9002, 'status': 'Healthy', 'cpu': 18, 'mem': 512, 'replicas': 5},
    {'name': 'KYC Service', 'lang': 'Python', 'port': 9003, 'status': 'Healthy', 'cpu': 8, 'mem': 384, 'replicas': 2},
    {'name': 'Fraud Detection', 'lang': 'Python', 'port': 9004, 'status': 'Degraded', 'cpu': 45, 'mem': 1024, 'replicas': 3},
    {'name': 'Card Service', 'lang': 'Rust', 'port': 9005, 'status': 'Healthy', 'cpu': 5, 'mem': 128, 'replicas': 2},
    {'name': 'Notification Service', 'lang': 'Go', 'port': 9006, 'status': 'Healthy', 'cpu': 10, 'mem': 192, 'replicas': 2},
    {'name': 'ML Inference', 'lang': 'Python', 'port': 9007, 'status': 'Healthy', 'cpu': 65, 'mem': 2048, 'replicas': 4},
    {'name': 'Event Store', 'lang': 'Rust', 'port': 9008, 'status': 'Healthy', 'cpu': 3, 'mem': 96, 'replicas': 3},
  ];

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 'All' ? _services : _services.where((s) => s['lang'] == _filter).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Service Catalog'), actions: [
        DropdownButton<String>(value: _filter, underline: const SizedBox(),
          items: ['All', 'Go', 'Python', 'Rust'].map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
          onChanged: (v) => setState(() => _filter = v!)),
      ]),
      body: ListView.builder(itemCount: filtered.length, itemBuilder: (ctx, i) {
        final s = filtered[i];
        final statusColor = s['status'] == 'Healthy' ? Colors.green : Colors.orange;
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: ListTile(
          leading: CircleAvatar(child: Text(s['lang'] as String, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold))),
          title: Text(s['name'] as String), subtitle: Text('Port: ${s["port"]} | CPU: ${s["cpu"]}% | Mem: ${s["mem"]}MB | Replicas: ${s["replicas"]}'),
          trailing: Icon(Icons.circle, color: statusColor, size: 12),
        ));
      }),
    );
  }
}
