import 'package:flutter/material.dart';

class RouteSchemaEnforcerScreen extends StatefulWidget {
  const RouteSchemaEnforcerScreen({super.key});
  @override
  State<RouteSchemaEnforcerScreen> createState() => _RouteSchemaEnforcerScreenState();
}

class _RouteSchemaEnforcerScreenState extends State<RouteSchemaEnforcerScreen> {
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
      appBar: AppBar(title: const Text('Route Schema Enforcer'), backgroundColor: Colors.green[700]),
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
              _kpi('Schemas', '512', Icons.schema),
              _kpi('Enforced', '100%', Icons.security),
              _kpi('Violations/day', '2.5K', Icons.warning),
              _kpi('Auto-reject', '100%', Icons.block),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Request Body Schema'),
              subtitle: Text('JSON Schema v7'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All POST/PUT/PATCH', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Enforced', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Query Param Schema'),
              subtitle: Text('Type Validation'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All GET endpoints', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Enforced', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Response Schema'),
              subtitle: Text('Contract Test'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('CI/CD validation', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Enforced', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Header Validation'),
              subtitle: Text('Required Headers'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Auth, Content-Type', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Enforced', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
