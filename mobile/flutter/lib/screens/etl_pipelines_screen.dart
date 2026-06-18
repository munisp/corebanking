import 'package:flutter/material.dart';

class ETLPipelinesScreen extends StatefulWidget {
  const ETLPipelinesScreen({super.key});
  @override
  State<ETLPipelinesScreen> createState() => _ETLPipelinesScreenState();
}

class _ETLPipelinesScreenState extends State<ETLPipelinesScreen> {
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
      appBar: AppBar(title: const Text('ETL Pipelines'), backgroundColor: Colors.green[700]),
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
              _kpi('Pipelines', '48', Icons.account_tree),
              _kpi('Daily Jobs', '2,500', Icons.work),
              _kpi('Data/day', '85TB', Icons.storage),
              _kpi('SLA Met', '99.5%', Icons.verified),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Transaction CDC→Lakehouse'),
              subtitle: Text('Real-time'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('2.5M events/hr', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Running', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Daily Returns'),
              subtitle: Text('Batch ETL'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('23:00 schedule', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Scheduled', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Customer 360 Enrichment'),
              subtitle: Text('Streaming'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('500K/hr', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Running', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('IFRS 9 ECL Calc'),
              subtitle: Text('Quarterly'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦345B portfolio', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Completed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
