import 'package:flutter/material.dart';

class E2EOrchestratorScreen extends StatefulWidget {
  const E2EOrchestratorScreen({super.key});
  @override
  State<E2EOrchestratorScreen> createState() => _E2EOrchestratorScreenState();
}

class _E2EOrchestratorScreenState extends State<E2EOrchestratorScreen> {
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
      appBar: AppBar(title: const Text('E2E Orchestrator'), backgroundColor: Colors.green[700]),
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
              _kpi('Test Suites', '85', Icons.playlist_play),
              _kpi('Pass Rate', '98.2%', Icons.check_circle),
              _kpi('Avg Duration', '12 min', Icons.timer),
              _kpi('Last Run', '02:00 UTC', Icons.schedule),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Transfer E2E (NIP/NEFT)'),
              subtitle: Text('Critical Path'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45 steps, 8 min', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Account Opening Flow'),
              subtitle: Text('Critical Path'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('32 steps, 5 min', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Loan Origination E2E'),
              subtitle: Text('Business Flow'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('58 steps, 12 min', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Card Issuance + Activation'),
              subtitle: Text('Business Flow'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('28 steps, 6 min', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Passing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
