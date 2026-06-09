import 'package:flutter/material.dart';

class BillingRbacScreen extends StatefulWidget {
  const BillingRbacScreen({super.key});
  @override
  State<BillingRbacScreen> createState() => _BillingRbacScreenState();
}

class _BillingRbacScreenState extends State<BillingRbacScreen> {
  bool _isLoading = false;

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
      appBar: AppBar(title: const Text('Billing RBAC'), backgroundColor: Colors.green[700]),
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
            _kpi('Roles', '8', Icons.admin_panel_settings),
            _kpi('Users', '45', Icons.people),
            _kpi('Permissions', '24', Icons.key),
            _kpi('Policies', '12', Icons.policy),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.admin_panel_settings, color: Colors.green),
              title: Text('Billing Admin'),
              subtitle: Text('Full access'),
              trailing: Text('3 users', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.analytics, color: Colors.green),
              title: Text('Billing Analyst'),
              subtitle: Text('Read + Reports'),
              trailing: Text('12 users', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.payment, color: Colors.green),
              title: Text('Billing Operator'),
              subtitle: Text('Process payments'),
              trailing: Text('18 users', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
