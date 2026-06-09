import 'package:flutter/material.dart';

class TaxReportingScreen extends StatefulWidget {
  const TaxReportingScreen({super.key});
  @override
  State<TaxReportingScreen> createState() => _TaxReportingScreenState();
}

class _TaxReportingScreenState extends State<TaxReportingScreen> {
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
      appBar: AppBar(title: const Text('Tax Reporting'), backgroundColor: Colors.green[700]),
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
              _kpi('WHT Remitted', '₦8.5B', Icons.receipt),
              _kpi('VAT Collected', '₦12B', Icons.money),
              _kpi('PAYE Filed', '₦5.2B', Icons.people),
              _kpi('Returns Due', '3', Icons.schedule),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Withholding Tax (WHT)'),
              subtitle: Text('FIRS'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('10% on interest', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Value Added Tax (VAT)'),
              subtitle: Text('FIRS'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('7.5% on services', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Company Income Tax (CIT)'),
              subtitle: Text('FIRS'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('30% of profit', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Due Q4', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Information Technology Levy'),
              subtitle: Text('NITDA'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('1% of PBT', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
