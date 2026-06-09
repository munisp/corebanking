import 'package:flutter/material.dart';

class PGQueryProfilesScreen extends StatefulWidget {
  const PGQueryProfilesScreen({super.key});
  @override
  State<PGQueryProfilesScreen> createState() => _PGQueryProfilesScreenState();
}

class _PGQueryProfilesScreenState extends State<PGQueryProfilesScreen> {
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
      appBar: AppBar(title: const Text('PG Query Profiles'), backgroundColor: Colors.green[700]),
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
              _kpi('Tracked Queries', '12K', Icons.code),
              _kpi('Slow (>100ms)', '45', Icons.slow_motion_video),
              _kpi('Top CPU', 'balance_check', Icons.memory),
              _kpi('Calls/s', '85K', Icons.speed),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('SELECT balance WHERE account_id'),
              subtitle: Text('Index Scan'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('0.2ms avg, 45K/s', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Optimized', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('INSERT INTO transactions'),
              subtitle: Text('Sequential'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('1.5ms avg, 25K/s', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Optimized', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('SELECT FOR UPDATE balance'),
              subtitle: Text('Row Lock'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('2.1ms avg, 12K/s', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Optimized', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('EXPLAIN ANALYZE (CBN report)'),
              subtitle: Text('Seq Scan'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('850ms avg, 12/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Acceptable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
