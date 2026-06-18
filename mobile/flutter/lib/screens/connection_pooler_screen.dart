import 'package:flutter/material.dart';

class ConnectionPoolerScreen extends StatefulWidget {
  const ConnectionPoolerScreen({super.key});
  @override
  State<ConnectionPoolerScreen> createState() => _ConnectionPoolerScreenState();
}

class _ConnectionPoolerScreenState extends State<ConnectionPoolerScreen> {
  bool _isLoading = false;

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
      appBar: AppBar(title: const Text('Connection Pooler'), backgroundColor: Colors.green[700]),
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
            _kpi('Active', '250', Icons.link),
            _kpi('Idle', '50', Icons.pause),
            _kpi('Max Pool', '500', Icons.pool),
            _kpi('Wait Queue', '0', Icons.hourglass_empty),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.storage, color: Colors.green),
              title: Text('PostgreSQL'),
              subtitle: Text('250 active / 500 max'),
              trailing: Text('Healthy', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.cached, color: Colors.green),
              title: Text('Redis'),
              subtitle: Text('100 active / 200 max'),
              trailing: Text('Healthy', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.stream, color: Colors.green),
              title: Text('Kafka'),
              subtitle: Text('50 active / 100 max'),
              trailing: Text('Healthy', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
