import 'package:flutter/material.dart';

class BatchProcessingScreen extends StatefulWidget {
  const BatchProcessingScreen({super.key});
  @override
  State<BatchProcessingScreen> createState() => _BatchProcessingScreenState();
}

class _BatchProcessingScreenState extends State<BatchProcessingScreen> {
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
      appBar: AppBar(title: const Text('Batch Processing'), backgroundColor: Colors.green[700]),
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
            _kpi('Pending', '3', Icons.hourglass_empty),
            _kpi('Running', '1', Icons.play_circle),
            _kpi('Completed', '24', Icons.check_circle),
            _kpi('Failed', '0', Icons.error),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.schedule, color: Colors.green),
              title: Text('EOD Processing'),
              subtitle: Text('Scheduled 23:00'),
              trailing: Text('Completed', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.percent, color: Colors.green),
              title: Text('Interest Accrual'),
              subtitle: Text('Daily batch'),
              trailing: Text('Running', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.description, color: Colors.green),
              title: Text('Statement Gen'),
              subtitle: Text('Monthly'),
              trailing: Text('Pending', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
