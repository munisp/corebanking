import 'package:flutter/material.dart';

class IncidentResponderScreen extends StatefulWidget {
  const IncidentResponderScreen({super.key});
  @override
  State<IncidentResponderScreen> createState() => _IncidentResponderScreenState();
}

class _IncidentResponderScreenState extends State<IncidentResponderScreen> {
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
      appBar: AppBar(title: const Text('Incident Responder'), backgroundColor: Colors.green[700]),
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
              _kpi('Open Incidents', '2', Icons.local_fire_department),
              _kpi('MTTR', '8.5 min', Icons.timer),
              _kpi('P1 This Month', '1', Icons.priority_high),
              _kpi('Runbooks', '45', Icons.menu_book),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('INC-045: Slow DB queries'),
              subtitle: Text('P3 - Performance'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Investigating', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Open', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('INC-044: Kafka lag spike'),
              subtitle: Text('P2 - Degraded'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Mitigated', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Open', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('INC-043: Card timeout'),
              subtitle: Text('P1 - Critical'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Resolved 12min', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Resolved', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('INC-042: SMS gateway'),
              subtitle: Text('P2 - Degraded'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Vendor failover', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Resolved', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
