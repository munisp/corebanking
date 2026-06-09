import 'package:flutter/material.dart';

class DockerHardenerScreen extends StatefulWidget {
  const DockerHardenerScreen({super.key});
  @override
  State<DockerHardenerScreen> createState() => _DockerHardenerScreenState();
}

class _DockerHardenerScreenState extends State<DockerHardenerScreen> {
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
      appBar: AppBar(title: const Text('Docker Hardener'), backgroundColor: Colors.green[700]),
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
              _kpi('Containers', '1,024', Icons.view_in_ar),
              _kpi('Vulnerabilities', '0 critical', Icons.shield),
              _kpi('Base Images', '12', Icons.layers),
              _kpi('Scan Freq', 'Hourly', Icons.schedule),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Distroless (Go services)'),
              subtitle: Text('gcr.io/distroless'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('211 services', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Hardened', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Python Slim'),
              subtitle: Text('python:3.12-slim'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('141 services', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Hardened', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Rust Scratch'),
              subtitle: Text('scratch'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('159 services', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Hardened', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Trivy Scanner'),
              subtitle: Text('CVE Detection'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('0 HIGH/CRITICAL', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Clean', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
