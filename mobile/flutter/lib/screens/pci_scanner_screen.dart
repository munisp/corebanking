import 'package:flutter/material.dart';

class PCIScannerScreen extends StatefulWidget {
  const PCIScannerScreen({super.key});
  @override
  State<PCIScannerScreen> createState() => _PCIScannerScreenState();
}

class _PCIScannerScreenState extends State<PCIScannerScreen> {
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
      appBar: AppBar(title: const Text('PCI Scanner'), backgroundColor: Colors.green[700]),
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
              _kpi('Scans/Week', '4', Icons.security),
              _kpi('PAN Exposure', '0', Icons.credit_card),
              _kpi('CVV Storage', '0', Icons.lock),
              _kpi('Compliance', '100%', Icons.verified),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Cardholder Data Scan'),
              subtitle: Text('PCI Req 3'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('0 PAN in logs', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Clean', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Network Segment Test'),
              subtitle: Text('PCI Req 1'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('CDE isolated', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Clean', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Encryption Validation'),
              subtitle: Text('PCI Req 4'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('TLS 1.3 only', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Clean', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.circle, color: Colors.green[400], size: 12),
              title: Text('Access Control Audit'),
              subtitle: Text('PCI Req 7'),
              trailing: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Least privilege', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text('Clean', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
              ]),
            )),
          ],
        ),
      ),
    );
  }
}
