import 'package:flutter/material.dart';

class PGSlowQueriesScreen extends StatefulWidget {
  const PGSlowQueriesScreen({super.key});
  @override
  State<PGSlowQueriesScreen> createState() => _PGSlowQueriesScreenState();
}

class _PGSlowQueriesScreenState extends State<PGSlowQueriesScreen> {
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
      appBar: AppBar(title: const Text('PG Slow Queries'), backgroundColor: Colors.green[700]),
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
              _kpi('Slow Queries', '45', Icons.slow_motion_video),
              _kpi('Threshold', '100ms', Icons.timer),
              _kpi('Top Offender', 'CBN report join', Icons.warning),
              _kpi('Avg Duration', '250ms', Icons.speed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Monthly Report Join'),
              subtitle: Text('Multi-table'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('850ms, 12/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Acceptable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Customer 360 Aggregate'),
              subtitle: Text('Materialized View'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('450ms, refresh 5min', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Optimized', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Transaction History (90d)'),
              subtitle: Text('Partition Scan'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('250ms, 2K/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Acceptable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Reconciliation Batch'),
              subtitle: Text('Full Table Scan'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('1.2s, 1/day EOD', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Acceptable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
