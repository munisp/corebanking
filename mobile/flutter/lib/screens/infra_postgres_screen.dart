import 'package:flutter/material.dart';

class InfraPostgresScreen extends StatefulWidget {
  const InfraPostgresScreen({super.key});
  @override
  State<InfraPostgresScreen> createState() => _InfraPostgresScreenState();
}

class _InfraPostgresScreenState extends State<InfraPostgresScreen> {
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
      appBar: AppBar(title: const Text('Infra Postgres'), backgroundColor: Colors.green[700]),
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
              _kpi('Clusters', '4', Icons.storage),
              _kpi('Total Size', '8.5TB', Icons.disc_full),
              _kpi('Connections', '5,000', Icons.cable),
              _kpi('Repl Lag', '0.2ms', Icons.sync),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('pg-core (Accounts/Txns)'),
              subtitle: Text('Primary + 2 Replicas'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('4.2TB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('pg-audit (Immutable)'),
              subtitle: Text('Append-only'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('2.8TB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('pg-analytics (Read)'),
              subtitle: Text('Logical Replication'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('1.2TB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Synced', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('pg-config (System)'),
              subtitle: Text('Single Node'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('300GB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
