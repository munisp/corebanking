import 'package:flutter/material.dart';

class ServiceHealthScreen extends StatefulWidget {
  const ServiceHealthScreen({super.key});
  @override
  State<ServiceHealthScreen> createState() => _ServiceHealthScreenState();
}

class _ServiceHealthScreenState extends State<ServiceHealthScreen> {
  Widget _kpi(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.green[700], size: 20),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Service Health'), backgroundColor: Colors.green[700]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
              _kpi('Services', '512', Icons.monitor_heart),
              _kpi('Healthy', '512', Icons.check_circle),
              _kpi('Degraded', '0', Icons.warning),
              _kpi('Down', '0', Icons.cancel),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Go Services (211)'),
              subtitle: Text('HTTP /healthz'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All responding', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Rust Services (159)'),
              subtitle: Text('HTTP /health'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All responding', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Python Services (141)'),
              subtitle: Text('HTTP /healthz'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All responding', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Infrastructure (Kafka/Redis/PG)'),
              subtitle: Text('TCP Check'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All ports open', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
