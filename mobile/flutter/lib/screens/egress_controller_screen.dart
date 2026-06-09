import 'package:flutter/material.dart';

class EgressControllerScreen extends StatefulWidget {
  const EgressControllerScreen({super.key});
  @override
  State<EgressControllerScreen> createState() => _EgressControllerScreenState();
}

class _EgressControllerScreenState extends State<EgressControllerScreen> {
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
      appBar: AppBar(title: const Text('Egress Controller'), backgroundColor: Colors.green[700]),
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
              _kpi('Outbound Rules', '85', Icons.exit_to_app),
              _kpi('Allowed Domains', '42', Icons.domain),
              _kpi('Blocked Today', '1,250', Icons.block),
              _kpi('Exfil Alerts', '3', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('NIBSS API Gateway'),
              subtitle: Text('Payment Switch'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('nibss.com.ng', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Allowed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Reporting'),
              subtitle: Text('Regulatory'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('cbn.gov.ng', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Allowed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('SWIFT Network'),
              subtitle: Text('International'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('swift.com', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Allowed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Unknown External IP'),
              subtitle: Text('Suspicious'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('185.x.x.x', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Blocked', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
