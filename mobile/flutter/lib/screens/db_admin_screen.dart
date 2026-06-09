import 'package:flutter/material.dart';

class DBAdminScreen extends StatefulWidget {
  const DBAdminScreen({super.key});
  @override
  State<DBAdminScreen> createState() => _DBAdminScreenState();
}

class _DBAdminScreenState extends State<DBAdminScreen> {
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
      appBar: AppBar(title: const Text('DB Admin'), backgroundColor: Colors.green[700]),
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
              _kpi('Indexes', '12,200', Icons.list),
              _kpi('Dead Tuples', '0.8%', Icons.delete),
              _kpi('Vacuum', 'Current', Icons.cleaning_services),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('accounts (850M rows)'),
              subtitle: Text('Core'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12 idx, 180GB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('transactions (2.5B rows)'),
              subtitle: Text('Core'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('18 idx, 1.2TB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('audit_trail (5B rows)'),
              subtitle: Text('Append-only'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8 idx, 800GB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('kyc_documents (45M rows)'),
              subtitle: Text('Compliance'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('6 idx, 250GB', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Healthy', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
