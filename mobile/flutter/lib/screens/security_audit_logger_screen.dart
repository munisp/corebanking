import 'package:flutter/material.dart';

class SecurityAuditLoggerScreen extends StatefulWidget {
  const SecurityAuditLoggerScreen({super.key});
  @override
  State<SecurityAuditLoggerScreen> createState() => _SecurityAuditLoggerScreenState();
}

class _SecurityAuditLoggerScreenState extends State<SecurityAuditLoggerScreen> {
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
      appBar: AppBar(title: const Text('Security Audit Logger'), backgroundColor: Colors.green[700]),
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
              _kpi('Events/day', '500K', Icons.history),
              _kpi('Retention', '7 years', Icons.lock),
              _kpi('Tamper-proof', '100%', Icons.shield),
              _kpi('Compliance', 'SOC 2', Icons.verified),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Login Events'),
              subtitle: Text('Auth'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Success + Failed', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logging', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Data Access Events'),
              subtitle: Text('Read/Write'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Who, When, What', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logging', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Admin Actions'),
              subtitle: Text('Privileged'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All config changes', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logging', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Export Events'),
              subtitle: Text('Data Movement'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Bulk downloads', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Logging', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
