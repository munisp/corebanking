import 'package:flutter/material.dart';

class KafkaConsumerOptimizerScreen extends StatefulWidget {
  const KafkaConsumerOptimizerScreen({super.key});
  @override
  State<KafkaConsumerOptimizerScreen> createState() => _KafkaConsumerOptimizerScreenState();
}

class _KafkaConsumerOptimizerScreenState extends State<KafkaConsumerOptimizerScreen> {
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
      appBar: AppBar(title: const Text('Kafka Consumer Optimizer'), backgroundColor: Colors.green[700]),
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
              _kpi('Groups', '48', Icons.group),
              _kpi('Partitions', '1,024', Icons.grid_view),
              _kpi('Max Lag', '250', Icons.schedule),
              _kpi('Rebalances/day', '3', Icons.sync),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('txn-processors (32)'),
              subtitle: Text('Range Assignor'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Lag 0-50', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Optimal', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('audit-writers (16)'),
              subtitle: Text('Sticky Assignor'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Lag 0-100', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Optimal', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('notif-senders (8)'),
              subtitle: Text('Cooperative'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Lag 0-250', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Acceptable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('analytics-agg (4)'),
              subtitle: Text('Round-Robin'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Lag 0-500', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Acceptable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
