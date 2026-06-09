import 'package:flutter/material.dart';

class OpenappsecEventsScreen extends StatefulWidget {
  const OpenappsecEventsScreen({super.key});
  @override
  State<OpenappsecEventsScreen> createState() => _OpenappsecEventsScreenState();
}

class _OpenappsecEventsScreenState extends State<OpenappsecEventsScreen> {
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
      appBar: AppBar(title: const Text('Openappsec Events'), backgroundColor: Colors.green[700]),
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
              _kpi('Events/hr', '45K', Icons.security),
              _kpi('Blocked', '1,250/hr', Icons.block),
              _kpi('Anomaly Score', 'Avg 15', Icons.analytics),
              _kpi('False Positive', '0.1%', Icons.error),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('SQL Injection Attempt'),
              subtitle: Text('OWASP A03'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('250/hr blocked', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Blocked', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('XSS Payload'),
              subtitle: Text('OWASP A07'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('180/hr blocked', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Blocked', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Path Traversal'),
              subtitle: Text('OWASP A01'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('85/hr blocked', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Blocked', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Bot Detection'),
              subtitle: Text('ML Model'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('735/hr challenged', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Challenged', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
