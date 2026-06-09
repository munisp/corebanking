import 'package:flutter/material.dart';

class EfassKYCReturnsScreen extends StatefulWidget {
  const EfassKYCReturnsScreen({super.key});
  @override
  State<EfassKYCReturnsScreen> createState() => _EfassKYCReturnsScreenState();
}

class _EfassKYCReturnsScreenState extends State<EfassKYCReturnsScreen> {
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
      appBar: AppBar(title: const Text('Efass KYC Returns'), backgroundColor: Colors.green[700]),
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
              _kpi('eFASS Filings', '48/yr', Icons.assignment),
              _kpi('KYC Returns', '12/yr', Icons.folder),
              _kpi('Compliance', '100%', Icons.check_circle),
              _kpi('Next Due', 'Mar 31', Icons.event),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Monthly KYC Return'),
              subtitle: Text('CBN Reporting'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Account stats by tier', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Quarterly eFASS'),
              subtitle: Text('Financial Statements'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Balance sheet + P&L', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Annual NDIC Return'),
              subtitle: Text('Deposit Insurance'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Premium calculation', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Ad-hoc CBN Request'),
              subtitle: Text('Regulatory'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('3 pending requests', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('In Progress', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
