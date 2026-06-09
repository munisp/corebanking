import 'package:flutter/material.dart';

class ApiAnalyticsScreen extends StatefulWidget {
  const ApiAnalyticsScreen({super.key});
  @override
  State<ApiAnalyticsScreen> createState() => _ApiAnalyticsScreenState();
}

class _ApiAnalyticsScreenState extends State<ApiAnalyticsScreen> {
  String _period = '24h';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('API Analytics'), actions: [
        SegmentedButton<String>(segments: const [
          ButtonSegment(value: '1h', label: Text('1H')), ButtonSegment(value: '24h', label: Text('24H')),
          ButtonSegment(value: '7d', label: Text('7D')), ButtonSegment(value: '30d', label: Text('30D')),
        ], selected: {_period}, onSelectionChanged: (v) => setState(() => _period = v.first)),
      ]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
        Row(children: [
          Expanded(child: _kpiCard('Requests', '14.8M', Colors.blue)),
          Expanded(child: _kpiCard('Avg Latency', '23ms', Colors.green)),
          Expanded(child: _kpiCard('Error Rate', '0.12%', Colors.orange)),
          Expanded(child: _kpiCard('Uptime', '99.99%', Colors.purple)),
        ]),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Top Endpoints by Volume', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          _endpointRow('POST /api/v1/transfers', '3.2M', '18ms', '0.05%'),
          _endpointRow('POST /api/v1/auth/token', '2.8M', '12ms', '0.02%'),
          _endpointRow('GET /api/v1/accounts/:id', '2.1M', '8ms', '0.01%'),
          _endpointRow('POST /api/v1/payments', '1.5M', '45ms', '0.15%'),
          _endpointRow('GET /api/v1/transactions', '1.2M', '32ms', '0.08%'),
        ]))),
        const SizedBox(height: 16),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Status Code Distribution', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          _statusBar('200 OK', 0.89, Colors.green),
          _statusBar('201 Created', 0.06, Colors.blue),
          _statusBar('400 Bad Request', 0.025, Colors.orange),
          _statusBar('401 Unauthorized', 0.015, Colors.red),
          _statusBar('500 Server Error', 0.001, Colors.red[900]!),
        ]))),
      ])),
    );
  }

  Widget _kpiCard(String label, String value, Color color) {
    return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ])));
  }

  Widget _endpointRow(String endpoint, String volume, String latency, String errorRate) {
    return ListTile(dense: true, title: Text(endpoint, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
      trailing: Text('$volume | $latency | $errorRate'));
  }

  Widget _statusBar(String label, double value, Color color) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
      SizedBox(width: 130, child: Text(label, style: const TextStyle(fontSize: 12))),
      Expanded(child: LinearProgressIndicator(value: value, color: color, minHeight: 8)),
      const SizedBox(width: 8), Text('${(value * 100).toStringAsFixed(1)}%', style: const TextStyle(fontSize: 12)),
    ]));
  }
}
