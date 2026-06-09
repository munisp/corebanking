import 'package:flutter/material.dart';

class SMSEmailGatewayScreen extends StatefulWidget {
  const SMSEmailGatewayScreen({super.key});
  @override
  State<SMSEmailGatewayScreen> createState() => _SMSEmailGatewayScreenState();
}

class _SMSEmailGatewayScreenState extends State<SMSEmailGatewayScreen> {
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
      appBar: AppBar(title: const Text('Sms Email Gateway'), backgroundColor: Colors.green[700]),
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
              _kpi('SMS/day', '1.2M', Icons.sms),
              _kpi('Email/day', '500K', Icons.email),
              _kpi('Providers', '3', Icons.dns),
              _kpi('Failover', 'Auto', Icons.sync),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Infobip (Primary SMS)'),
              subtitle: Text('SMS Provider'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('800K/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Twilio (Backup SMS)'),
              subtitle: Text('SMS Failover'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('400K/day capacity', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Standby', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('SendGrid (Email)'),
              subtitle: Text('Email Provider'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('500K/day', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Mailgun (Backup Email)'),
              subtitle: Text('Email Failover'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('250K/day capacity', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Standby', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
