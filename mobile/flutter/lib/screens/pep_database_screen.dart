import 'package:flutter/material.dart';

class PEPDatabaseScreen extends StatefulWidget {
  const PEPDatabaseScreen({super.key});
  @override
  State<PEPDatabaseScreen> createState() => _PEPDatabaseScreenState();
}

class _PEPDatabaseScreenState extends State<PEPDatabaseScreen> {
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
      appBar: AppBar(title: const Text('Pep Database'), backgroundColor: Colors.green[700]),
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
              _kpi('PEP Records', '25K', Icons.people),
              _kpi('Countries', '195', Icons.public),
              _kpi('Last Update', 'Today', Icons.update),
              _kpi('Sources', '12', Icons.source),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Nigerian PEPs'),
              subtitle: Text('Government Officials'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8,500 records', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('International PEPs'),
              subtitle: Text('Heads of State/Govt'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12K records', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Family/Associates'),
              subtitle: Text('RCA'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('4.5K records', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('State-Owned Enterprise'),
              subtitle: Text('SOE Officials'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('2K records', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Current', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
