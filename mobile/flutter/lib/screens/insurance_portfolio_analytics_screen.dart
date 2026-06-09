import 'package:flutter/material.dart';

class InsurancePortfolioAnalyticsScreen extends StatefulWidget {
  const InsurancePortfolioAnalyticsScreen({super.key});
  @override
  State<InsurancePortfolioAnalyticsScreen> createState() => _InsurancePortfolioAnalyticsScreenState();
}

class _InsurancePortfolioAnalyticsScreenState extends State<InsurancePortfolioAnalyticsScreen> {
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
      appBar: AppBar(title: const Text('Insurance Portfolio Analytics'), backgroundColor: Colors.green[700]),
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
              _kpi('GWP', '₦85B', Icons.shield),
              _kpi('Claims Ratio', '62%', Icons.pie_chart),
              _kpi('Combined Ratio', '95%', Icons.analytics),
              _kpi('Reinsurance', '₦32B', Icons.security),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Fire & Burglary Portfolio'),
              subtitle: Text('Property'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('GWP ₦22B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Profitable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Motor Insurance Book'),
              subtitle: Text('Motor'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('GWP ₦18B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Profitable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Marine Cargo'),
              subtitle: Text('Marine'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('GWP ₦12B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Profitable', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Life Assurance'),
              subtitle: Text('Life'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('GWP ₦25B', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Growing', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
