import 'package:flutter/material.dart';

class SecurityHardeningScreen extends StatefulWidget {
  const SecurityHardeningScreen({super.key});
  @override
  State<SecurityHardeningScreen> createState() => _SecurityHardeningScreenState();
}

class _SecurityHardeningScreenState extends State<SecurityHardeningScreen> {
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
      appBar: AppBar(title: const Text('Security Hardening'), backgroundColor: Colors.green[700]),
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
              _kpi('CIS Controls', '256', Icons.security),
              _kpi('Compliant', '256', Icons.check),
              _kpi('Exceptions', '0', Icons.warning),
              _kpi('Score', '100%', Icons.star),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Container Hardening'),
              subtitle: Text('CIS Docker'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Distroless + non-root', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Hardened', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Kubernetes Hardening'),
              subtitle: Text('CIS K8s'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('PSP + NetworkPolicy', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Hardened', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('OS Hardening'),
              subtitle: Text('CIS Ubuntu'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Minimal attack surface', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Hardened', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('TLS Configuration'),
              subtitle: Text('Mozilla Modern'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('TLS 1.3 only', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Hardened', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
