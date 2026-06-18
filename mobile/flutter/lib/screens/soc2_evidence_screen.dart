import 'package:flutter/material.dart';

class Soc2EvidenceScreen extends StatefulWidget {
  const Soc2EvidenceScreen({super.key});
  @override
  State<Soc2EvidenceScreen> createState() => _Soc2EvidenceScreenState();
}

class _Soc2EvidenceScreenState extends State<Soc2EvidenceScreen> {
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
      appBar: AppBar(title: const Text('Soc2 Evidence'), backgroundColor: Colors.green[700]),
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
              _kpi('Controls', '125', Icons.fact_check),
              _kpi('Evidence Items', '850', Icons.description),
              _kpi('Auto-collected', '92%', Icons.auto_fix_high),
              _kpi('Audit Ready', '100%', Icons.verified),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CC6.1 Access Control'),
              subtitle: Text('Logical Access'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45 evidence items', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CC7.2 System Monitoring'),
              subtitle: Text('Monitoring'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('85 evidence items', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CC8.1 Change Management'),
              subtitle: Text('SDLC'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('120 evidence items', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('A1.2 Availability'),
              subtitle: Text('Uptime SLA'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('99.95% proven', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
