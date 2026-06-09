import 'package:flutter/material.dart';

class IdentityChannelsScreen extends StatefulWidget {
  const IdentityChannelsScreen({super.key});
  @override
  State<IdentityChannelsScreen> createState() => _IdentityChannelsScreenState();
}

class _IdentityChannelsScreenState extends State<IdentityChannelsScreen> {
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
      appBar: AppBar(title: const Text('Identity Channels'), backgroundColor: Colors.green[700]),
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
              _kpi('Channels', '8', Icons.devices),
              _kpi('Auth/day', '500K', Icons.login),
              _kpi('Success', '99.5%', Icons.check),
              _kpi('MFA Rate', '85%', Icons.security),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Mobile App (Biometric)'),
              subtitle: Text('Face/Fingerprint'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('250K auth/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Web Portal (Password+OTP)'),
              subtitle: Text('MFA Required'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('125K auth/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('USSD (PIN)'),
              subtitle: Text('4-digit PIN'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('85K auth/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('API (OAuth 2.0)'),
              subtitle: Text('Client Credentials'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45K auth/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
