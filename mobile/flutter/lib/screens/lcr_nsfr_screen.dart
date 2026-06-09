import 'package:flutter/material.dart';

class LCRNSFRScreen extends StatefulWidget {
  const LCRNSFRScreen({super.key});
  @override
  State<LCRNSFRScreen> createState() => _LCRNSFRScreenState();
}

class _LCRNSFRScreenState extends State<LCRNSFRScreen> {
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
      appBar: AppBar(title: const Text('Lcr Nsfr'), backgroundColor: Colors.green[700]),
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
              _kpi('LCR', '185%', Icons.shield),
              _kpi('NSFR', '125%', Icons.security),
              _kpi('HQLA', '₦250B', Icons.account_balance),
              _kpi('Net Outflow', '₦135B', Icons.trending_down),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Level 1 HQLA (Cash + T-Bills)'),
              subtitle: Text('100% weight'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦180B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Compliant', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Level 2A HQLA (Corp Bonds)'),
              subtitle: Text('85% weight'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦50B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Compliant', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Level 2B HQLA (Equities)'),
              subtitle: Text('50% weight'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦20B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Compliant', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('30-Day Net Cash Outflow'),
              subtitle: Text('Stress Scenario'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦135B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Within Limit', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
