import 'package:flutter/material.dart';

class IPAllowlistScreen extends StatefulWidget {
  const IPAllowlistScreen({super.key});
  @override
  State<IPAllowlistScreen> createState() => _IPAllowlistScreenState();
}

class _IPAllowlistScreenState extends State<IPAllowlistScreen> {
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
      appBar: AppBar(title: const Text('IP Allowlist'), backgroundColor: Colors.green[700]),
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
              _kpi('Whitelisted', '250', Icons.verified_user),
              _kpi('Blocked/day', '12K', Icons.block),
              _kpi('Admin Ranges', '8', Icons.admin_panel_settings),
              _kpi('Updated', 'Today', Icons.update),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('NIBSS Network'),
              subtitle: Text('Corporate'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('196.x.x.0/24', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Allowed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Gateway'),
              subtitle: Text('Regulatory'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('41.x.x.0/28', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Allowed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Office VPN'),
              subtitle: Text('Internal'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('10.0.0.0/8', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Allowed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Partner APIs'),
              subtitle: Text('Third-party'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('52 static IPs', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Allowed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
