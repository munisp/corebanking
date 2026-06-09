import 'package:flutter/material.dart';

class RegulatoryCalendarScreen extends StatefulWidget {
  const RegulatoryCalendarScreen({super.key});
  @override
  State<RegulatoryCalendarScreen> createState() => _RegulatoryCalendarScreenState();
}

class _RegulatoryCalendarScreenState extends State<RegulatoryCalendarScreen> {
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
      appBar: AppBar(title: const Text('Regulatory Calendar'), backgroundColor: Colors.green[700]),
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
              _kpi('Deadlines/yr', '285', Icons.calendar_today),
              _kpi('This Month', '12', Icons.event),
              _kpi('Overdue', '0', Icons.check),
              _kpi('Upcoming (7d)', '3', Icons.upcoming),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CBN Monthly Returns'),
              subtitle: Text('Due: 15th'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Balance sheet, P&L', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On Track', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('NFIU Quarterly Report'),
              subtitle: Text('Due: Mar 31'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('AML/CFT compliance', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On Track', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('NDIC Premium Payment'),
              subtitle: Text('Due: Mar 30'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦250M premium', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On Track', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Annual Financial Statement'),
              subtitle: Text('Due: Mar 31'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Audited accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('On Track', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
