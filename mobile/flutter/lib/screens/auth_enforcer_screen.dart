import 'package:flutter/material.dart';

class AuthEnforcerScreen extends StatefulWidget {
  const AuthEnforcerScreen({super.key});
  @override
  State<AuthEnforcerScreen> createState() => _AuthEnforcerScreenState();
}

class _AuthEnforcerScreenState extends State<AuthEnforcerScreen> {
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
      appBar: AppBar(title: const Text('Auth Enforcer'), backgroundColor: Colors.green[700]),
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
            _kpi('Active Sessions', '12,450', Icons.people),
            _kpi('Failed Auth', '234', Icons.lock),
            _kpi('MFA Rate', '78%', Icons.security),
            _kpi('Token TTL', '15min', Icons.timer),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.key, color: Colors.green),
              title: Text('JWT Validation'),
              subtitle: Text('All API calls'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.admin_panel_settings, color: Colors.green),
              title: Text('Role-Based Access'),
              subtitle: Text('RBAC enforced'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
