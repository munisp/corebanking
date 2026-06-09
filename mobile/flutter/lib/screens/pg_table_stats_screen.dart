import 'package:flutter/material.dart';

class PGTableStatsScreen extends StatefulWidget {
  const PGTableStatsScreen({super.key});
  @override
  State<PGTableStatsScreen> createState() => _PGTableStatsScreenState();
}

class _PGTableStatsScreenState extends State<PGTableStatsScreen> {
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
      appBar: AppBar(title: const Text('PG Table Stats'), backgroundColor: Colors.green[700]),
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
              _kpi('Tables', '8,500', Icons.table_chart),
              _kpi('Total Size', '4.2TB', Icons.storage),
              _kpi('Bloat', '2.5%', Icons.pie_chart),
              _kpi('Autovacuum', 'Active', Icons.cleaning_services),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('transactions (2.5B rows)'),
              subtitle: Text('Partitioned by date'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('1.2TB, 0.8% bloat', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('accounts (850M rows)'),
              subtitle: Text('Clustered by id'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('180GB, 1.2% bloat', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('audit_trail (5B rows)'),
              subtitle: Text('Append-only'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('800GB, 0% bloat', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('kyc_documents (45M)'),
              subtitle: Text('TOAST for blobs'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('250GB, 3.5% bloat', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
