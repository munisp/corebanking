import 'package:flutter/material.dart';

class DormancyMgmtScreen extends StatefulWidget {
  const DormancyMgmtScreen({super.key});
  @override
  State<DormancyMgmtScreen> createState() => _DormancyMgmtScreenState();
}

class _DormancyMgmtScreenState extends State<DormancyMgmtScreen> {
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
      appBar: AppBar(title: const Text('Dormancy Mgmt'), backgroundColor: Colors.green[700]),
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
              _kpi('Dormant Accounts', '125K', Icons.hotel),
              _kpi('Unclaimed Funds', '₦8.5B', Icons.money_off),
              _kpi('Reactivated MTD', '2,500', Icons.refresh),
              _kpi('CBN Transfers Due', '₦1.2B', Icons.send),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('6-Month Inactive'),
              subtitle: Text('Pre-Dormant'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('45,000 accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('SMS Sent', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('12-Month Inactive'),
              subtitle: Text('Dormant'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('55,000 accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Restricted', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('10-Year Unclaimed'),
              subtitle: Text('CBN Transfer Due'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('25,000 accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Pending Transfer', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Reactivation Queue'),
              subtitle: Text('Customer Request'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('850 pending', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('In Process', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
