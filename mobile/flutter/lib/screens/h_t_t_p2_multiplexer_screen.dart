import 'package:flutter/material.dart';

class HTTP2MultiplexerScreen extends StatefulWidget {
  const HTTP2MultiplexerScreen({super.key});
  @override
  State<HTTP2MultiplexerScreen> createState() => _HTTP2MultiplexerScreenState();
}

class _HTTP2MultiplexerScreenState extends State<HTTP2MultiplexerScreen> {
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
      appBar: AppBar(title: const Text('HTTP2 Multiplexer'), backgroundColor: Colors.green[700]),
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
            _kpi('Total', '1,245', Icons.analytics),
            _kpi('Active', '1,200', Icons.check_circle),
            _kpi('Success', '99.5%', Icons.trending_up),
            _kpi('Alerts', '3', Icons.warning),
              ],
            ),
            const SizedBox(height: 16),
            Card(child: ListTile(
              leading: Icon(Icons.check_circle, color: Colors.green),
              title: Text('Primary'),
              subtitle: Text('Main functionality'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
            Card(child: ListTile(
              leading: Icon(Icons.settings, color: Colors.green),
              title: Text('Secondary'),
              subtitle: Text('Supporting feature'),
              trailing: Text('Active', style: const TextStyle(fontWeight: FontWeight.bold)),
            )),
          ],
        ),
      ),
    );
  }
}
