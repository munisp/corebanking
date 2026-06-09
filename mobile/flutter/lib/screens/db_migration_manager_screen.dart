import 'package:flutter/material.dart';

class DBMigrationManagerScreen extends StatefulWidget {
  const DBMigrationManagerScreen({super.key});
  @override
  State<DBMigrationManagerScreen> createState() => _DBMigrationManagerScreenState();
}

class _DBMigrationManagerScreenState extends State<DBMigrationManagerScreen> {
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
      appBar: AppBar(title: const Text('DB Migration Manager'), backgroundColor: Colors.green[700]),
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
              _kpi('Applied', '342', Icons.check_circle),
              _kpi('Pending', '0', Icons.pending),
              _kpi('Rollbacks', '3', Icons.undo),
              _kpi('Last Run', 'Jan 15', Icons.calendar_today),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('V342: IFRS9 staging tables'),
              subtitle: Text('Schema'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Applied Jan 15', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Applied', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('V341: kobo BIGINT columns'),
              subtitle: Text('Data Migration'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Applied Jan 10', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Applied', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('V340: idempotency_keys'),
              subtitle: Text('Schema'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Applied Jan 05', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Applied', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('V339: audit_trail rules'),
              subtitle: Text('Security'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Applied Jan 01', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Applied', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
