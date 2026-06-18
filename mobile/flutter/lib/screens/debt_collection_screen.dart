import 'package:flutter/material.dart';

class DebtCollectionScreen extends StatefulWidget {
  const DebtCollectionScreen({super.key});
  @override
  State<DebtCollectionScreen> createState() => _DebtCollectionScreenState();
}

class _DebtCollectionScreenState extends State<DebtCollectionScreen> {
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
      appBar: AppBar(title: const Text('Debt Collection'), backgroundColor: Colors.green[700]),
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
              _kpi('Total Outstanding', '₦45.2B', Icons.money_off),
              _kpi('Recovery Rate', '72.5%', Icons.trending_up),
              _kpi('Active Cases', '8,450', Icons.folder_open),
              _kpi('NPL Ratio', '4.8%', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Zenith Manufacturing Ltd'),
              subtitle: Text('Corporate Loan'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦850M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Demand Notice Sent', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Adebayo Farms Enterprise'),
              subtitle: Text('Agriculture Loan'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦125M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Restructured', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Lagos Auto Dealers'),
              subtitle: Text('Asset Finance'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦340M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Legal Action', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('TechHub Nigeria Ltd'),
              subtitle: Text('Working Capital'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₦95M', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Payment Plan Active', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
