import 'package:flutter/material.dart';

class CorporateMonitoringScreen extends StatefulWidget {
  const CorporateMonitoringScreen({super.key});
  @override
  State<CorporateMonitoringScreen> createState() => _CorporateMonitoringScreenState();
}

class _CorporateMonitoringScreenState extends State<CorporateMonitoringScreen> {
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
      appBar: AppBar(title: const Text('Corporate Monitoring'), backgroundColor: Colors.green[700]),
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
            _kpi('Corporates', '4,500', Icons.business),
            _kpi('Active Alerts', '12', Icons.warning),
            _kpi('Compliance', '98.5%', Icons.check_circle),
            _kpi('Revenue', '₦2.4B', Icons.payments),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.business, color: Colors.green),
              title: Text('Dangote Group'),
              subtitle: Text('15 accounts, ₦45B balance'),
              trailing: Text('Green', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.business, color: Colors.green),
              title: Text('BUA Cement'),
              subtitle: Text('8 accounts, ₦12B balance'),
              trailing: Text('Green', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
