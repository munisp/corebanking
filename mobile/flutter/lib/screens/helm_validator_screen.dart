import 'package:flutter/material.dart';

class HelmValidatorScreen extends StatefulWidget {
  const HelmValidatorScreen({super.key});
  @override
  State<HelmValidatorScreen> createState() => _HelmValidatorScreenState();
}

class _HelmValidatorScreenState extends State<HelmValidatorScreen> {
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
      appBar: AppBar(title: const Text('Helm Validator'), backgroundColor: Colors.green[700]),
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
              _kpi('Charts', '85', Icons.fact_check),
              _kpi('Releases', '512', Icons.rocket),
              _kpi('Lint Errors', '0', Icons.check),
              _kpi('Dry-Run', '100%', Icons.verified),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54bank-services (Umbrella)'),
              subtitle: Text('v3.2.1'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('512 sub-charts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Valid', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54bank-infra'),
              subtitle: Text('v2.8.0'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8 sub-charts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Valid', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54bank-monitoring'),
              subtitle: Text('v1.5.0'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('4 sub-charts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Valid', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Values Schema'),
              subtitle: Text('JSON Schema'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('85 schemas pass', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Valid', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
