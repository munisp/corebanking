import 'package:flutter/material.dart';

class CorsGatewayScreen extends StatefulWidget {
  const CorsGatewayScreen({super.key});
  @override
  State<CorsGatewayScreen> createState() => _CorsGatewayScreenState();
}

class _CorsGatewayScreenState extends State<CorsGatewayScreen> {
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
      appBar: AppBar(title: const Text('CORS Gateway'), backgroundColor: Colors.green[700]),
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
            _kpi('Origins', '12', Icons.public),
            _kpi('Methods', 'GET,POST,PUT', Icons.code),
            _kpi('Max Age', '3600s', Icons.timer),
            _kpi('Blocked', '45/hr', Icons.block),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.check, color: Colors.green),
              title: Text('*.54bank.ng'),
              subtitle: Text('All methods allowed'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.handshake, color: Colors.green),
              title: Text('partner-api.com'),
              subtitle: Text('GET, POST only'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
