import 'package:flutter/material.dart';

class SanctionsScreeningScreen extends StatefulWidget {
  const SanctionsScreeningScreen({super.key});
  @override
  State<SanctionsScreeningScreen> createState() => _SanctionsScreeningScreenState();
}

class _SanctionsScreeningScreenState extends State<SanctionsScreeningScreen> {
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
      appBar: AppBar(title: const Text('Sanctions Screening'), backgroundColor: Colors.green[700]),
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
              _kpi('Screened Today', '125K', Icons.search),
              _kpi('Matches', '42', Icons.warning),
              _kpi('False Positives', '38', Icons.cancel),
              _kpi('True Hits', '4', Icons.error),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('OFAC SDN List'),
              subtitle: Text('US Sanctions'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('12,500 entries', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Updated', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('EU Consolidated List'),
              subtitle: Text('EU Sanctions'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('8,200 entries', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Updated', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('UN Security Council'),
              subtitle: Text('UN Sanctions'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('6,800 entries', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Updated', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Terrorism List'),
              subtitle: Text('Nigeria'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('450 entries', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Updated', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
