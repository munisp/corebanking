import 'package:flutter/material.dart';

class ErrorCatalogScreen extends StatefulWidget {
  const ErrorCatalogScreen({super.key});
  @override
  State<ErrorCatalogScreen> createState() => _ErrorCatalogScreenState();
}

class _ErrorCatalogScreenState extends State<ErrorCatalogScreen> {
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
      appBar: AppBar(title: const Text('Error Catalog'), backgroundColor: Colors.green[700]),
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
              _kpi('Error Codes', '450', Icons.error),
              _kpi('Active Errors', '12', Icons.warning),
              _kpi('Resolved Today', '28', Icons.check_circle),
              _kpi('P1 Incidents', '0', Icons.priority_high),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('ERR_INSUFFICIENT_BALANCE'),
              subtitle: Text('Business'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45K/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Expected', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('ERR_KYC_TIER_EXCEEDED'),
              subtitle: Text('Compliance'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12K/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Expected', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('ERR_DUPLICATE_TXN'),
              subtitle: Text('Idempotency'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8.5K/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Expected', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('ERR_DB_TIMEOUT'),
              subtitle: Text('Infrastructure'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('0/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Resolved', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
