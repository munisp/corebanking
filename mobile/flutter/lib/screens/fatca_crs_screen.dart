import 'package:flutter/material.dart';

class FatcaCrsScreen extends StatefulWidget {
  const FatcaCrsScreen({super.key});
  @override
  State<FatcaCrsScreen> createState() => _FatcaCrsScreenState();
}

class _FatcaCrsScreenState extends State<FatcaCrsScreen> {
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
      appBar: AppBar(title: const Text('Fatca Crs'), backgroundColor: Colors.green[700]),
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
              _kpi('US Reportable', '4,500', Icons.flag),
              _kpi('CRS Reportable', '12,000', Icons.public),
              _kpi('Last Filing', '2024-09-30', Icons.calendar_today),
              _kpi('Entities Reviewed', '85K', Icons.search),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('FATCA - US Persons'),
              subtitle: Text('IRS Reporting'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('4,500 accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CRS - UK Tax Residents'),
              subtitle: Text('HMRC Exchange'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('3,200 accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('CRS - UAE Residents'),
              subtitle: Text('Auto Exchange'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('1,800 accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Filed', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Indicia Review Pending'),
              subtitle: Text('Due Diligence'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('250 accounts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('In Review', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
