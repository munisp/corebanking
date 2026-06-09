import 'package:flutter/material.dart';

class PGIndexAdvisoryScreen extends StatefulWidget {
  const PGIndexAdvisoryScreen({super.key});
  @override
  State<PGIndexAdvisoryScreen> createState() => _PGIndexAdvisoryScreenState();
}

class _PGIndexAdvisoryScreenState extends State<PGIndexAdvisoryScreen> {
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
      appBar: AppBar(title: const Text('PG Index Advisory'), backgroundColor: Colors.green[700]),
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
              _kpi('Suggestions', '25', Icons.lightbulb),
              _kpi('Unused Indexes', '12', Icons.delete),
              _kpi('Missing Indexes', '8', Icons.add),
              _kpi('Index Bloat', '3.5%', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('accounts(bvn) - Missing'),
              subtitle: Text('High Impact'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45K scans/day→index', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Recommend', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('transactions(date,acct) - Missing'),
              subtitle: Text('High Impact'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Range scan optimize', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Recommend', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('kyc_docs(status) - Unused'),
              subtitle: Text('Low Write Cost'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('0 scans in 30d', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Drop', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('audit_trail(user_id) - Bloated'),
              subtitle: Text('Maintenance'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('REINDEX recommended', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Review', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
