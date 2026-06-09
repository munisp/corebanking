import 'package:flutter/material.dart';

class CocoindexPipelineScreen extends StatefulWidget {
  const CocoindexPipelineScreen({super.key});
  @override
  State<CocoindexPipelineScreen> createState() => _CocoindexPipelineScreenState();
}

class _CocoindexPipelineScreenState extends State<CocoindexPipelineScreen> {
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
      appBar: AppBar(title: const Text('CocoIndex Pipeline'), backgroundColor: Colors.green[700]),
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
            _kpi('Pipelines', '8', Icons.device_hub),
            _kpi('Running', '6', Icons.play_circle),
            _kpi('Throughput', '45K/s', Icons.speed),
            _kpi('Lag', '120ms', Icons.timer),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.receipt, color: Colors.green),
              title: Text('Transaction Index'),
              subtitle: Text('Real-time CDC'),
              trailing: Text('Running', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.person, color: Colors.green),
              title: Text('Customer Index'),
              subtitle: Text('Near-real-time'),
              trailing: Text('Running', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.history, color: Colors.green),
              title: Text('Audit Index'),
              subtitle: Text('Batch daily'),
              trailing: Text('Scheduled', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
