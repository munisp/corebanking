import 'package:flutter/material.dart';

class FraudDetectionScreen extends StatefulWidget {
  const FraudDetectionScreen({super.key});
  @override
  State<FraudDetectionScreen> createState() => _FraudDetectionScreenState();
}

class _FraudDetectionScreenState extends State<FraudDetectionScreen> {
  final List<Map<String, dynamic>> _alerts = [
    {'id': 'FRD-1001', 'type': 'Velocity', 'amount': 4500000, 'account': '00123456', 'score': 0.92, 'time': '14:32', 'status': 'blocked'},
    {'id': 'FRD-1002', 'type': 'Geo-anomaly', 'amount': 890000, 'account': '00234567', 'score': 0.78, 'time': '14:28', 'status': 'review'},
    {'id': 'FRD-1003', 'type': 'Device change', 'amount': 2100000, 'account': '00345678', 'score': 0.85, 'time': '14:15', 'status': 'blocked'},
    {'id': 'FRD-1004', 'type': 'Unusual hour', 'amount': 1200000, 'account': '00456789', 'score': 0.65, 'time': '03:22', 'status': 'review'},
    {'id': 'FRD-1005', 'type': 'Beneficiary pattern', 'amount': 9800000, 'account': '00567890', 'score': 0.95, 'time': '14:05', 'status': 'escalated'},
  ];

  final Map<String, dynamic> _stats = {
    'blocked_today': 23, 'amount_saved': 45600000, 'false_positive_rate': 2.3, 'avg_detection_ms': 145,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fraud Detection'), backgroundColor: Colors.red.shade700),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: _statCard('Blocked Today', '${_stats["blocked_today"]}', Icons.block, Colors.red)),
            const SizedBox(width: 8),
            Expanded(child: _statCard('Amount Saved', '\u20A6${(_stats["amount_saved"] / 100000).toStringAsFixed(1)}K', Icons.shield, Colors.green)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _statCard('False Positive', '${_stats["false_positive_rate"]}%', Icons.thumb_down, Colors.orange)),
            const SizedBox(width: 8),
            Expanded(child: _statCard('Detect Latency', '${_stats["avg_detection_ms"]}ms', Icons.speed, Colors.blue)),
          ]),
          const SizedBox(height: 24),
          const Text('Live Alerts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...List.generate(_alerts.length, (i) {
            final a = _alerts[i];
            Color statusColor = a['status'] == 'blocked' ? Colors.red : a['status'] == 'escalated' ? Colors.purple : Colors.orange;
            return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(a['id'], style: const TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                    child: Text(a['status'].toUpperCase(), style: TextStyle(color: statusColor, fontSize: 11))),
                ]),
                const SizedBox(height: 4),
                Text('${a["type"]} | \u20A6${(a["amount"] / 100).toStringAsFixed(0)} | Acc: ${a["account"]}'),
                const SizedBox(height: 4),
                Row(children: [
                  Text('Score: ${(a["score"] * 100).toStringAsFixed(0)}%', style: TextStyle(
                    color: a['score'] > 0.8 ? Colors.red : Colors.orange, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  Text(a['time'], style: const TextStyle(color: Colors.grey)),
                ]),
                if (a['status'] == 'review') ...[
                  const SizedBox(height: 8),
                  Row(children: [
                    ElevatedButton(onPressed: () {}, style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                      child: const Text('Block', style: TextStyle(color: Colors.white))),
                    const SizedBox(width: 8),
                    OutlinedButton(onPressed: () {}, child: const Text('Allow')),
                  ]),
                ],
              ],
            )));
          }),
        ]),
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) => Card(
    child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Icon(icon, color: color, size: 28),
      const SizedBox(height: 4),
      Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ])),
  );
}
