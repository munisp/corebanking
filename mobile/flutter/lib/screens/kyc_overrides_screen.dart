import 'package:flutter/material.dart';

class KYCOverridesScreen extends StatefulWidget {
  const KYCOverridesScreen({super.key});
  @override
  State<KYCOverridesScreen> createState() => _KYCOverridesScreenState();
}

class _KYCOverridesScreenState extends State<KYCOverridesScreen> {
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
      appBar: AppBar(title: const Text('Kyc Overrides'), backgroundColor: Colors.green[700]),
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
              _kpi('Overrides/mo', '85', Icons.admin_panel_settings),
              _kpi('Approved', '72', Icons.check),
              _kpi('Rejected', '13', Icons.close),
              _kpi('Audit Trail', '100%', Icons.history),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Tier Upgrade Override'),
              subtitle: Text('Manager Approval'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Bypass verification', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logged', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Document Exception'),
              subtitle: Text('COO Approval'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Accept alternate ID', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logged', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Risk Score Override'),
              subtitle: Text('MLRO Approval'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Downgrade risk level', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logged', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Transaction Limit Override'),
              subtitle: Text('Dual Approval'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Temp limit increase', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logged', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
