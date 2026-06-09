import 'package:flutter/material.dart';

class MojaloopAdminParticipantsScreen extends StatefulWidget {
  const MojaloopAdminParticipantsScreen({super.key});
  @override
  State<MojaloopAdminParticipantsScreen> createState() => _MojaloopAdminParticipantsScreenState();
}

class _MojaloopAdminParticipantsScreenState extends State<MojaloopAdminParticipantsScreen> {
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
      appBar: AppBar(title: const Text('Mojaloop Admin Participants'), backgroundColor: Colors.green[700]),
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
              _kpi('DFSPs', '18', Icons.business),
              _kpi('Active', '16', Icons.check),
              _kpi('Suspended', '2', Icons.pause),
              _kpi('Settlement Accts', '36', Icons.account_balance),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('54Bank Nigeria'),
              subtitle: Text('Hub Operator'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('All corridors', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('FirstBank DFSP'),
              subtitle: Text('Participant'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦85B settled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('GTBank DFSP'),
              subtitle: Text('Participant'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦65B settled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Paga Mobile Money'),
              subtitle: Text('MMO'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦12B settled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
