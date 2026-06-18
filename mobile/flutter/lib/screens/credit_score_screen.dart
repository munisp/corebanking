import 'package:flutter/material.dart';

/// Credit Score — CRC/FirstCentral credit bureau score with improvement tips
class CreditScoreScreen extends StatefulWidget {
  const CreditScoreScreen({super.key});
  @override
  State<CreditScoreScreen> createState() => _CreditScoreScreenState();
}

class _CreditScoreScreenState extends State<CreditScoreScreen> {
  final _score = 720;
  final _maxScore = 850;
  final _history = [
    {'month': 'Jun 2026', 'score': 720},
    {'month': 'May 2026', 'score': 715},
    {'month': 'Apr 2026', 'score': 708},
    {'month': 'Mar 2026', 'score': 695},
    {'month': 'Feb 2026', 'score': 690},
  ];

  final _factors = [
    {'factor': 'Payment History', 'impact': 'positive', 'desc': 'All payments on time for 24 months'},
    {'factor': 'Credit Utilization', 'impact': 'positive', 'desc': '32% of available credit used'},
    {'factor': 'Credit Age', 'impact': 'neutral', 'desc': 'Average account age: 3.5 years'},
    {'factor': 'Credit Mix', 'impact': 'positive', 'desc': 'Healthy mix of credit types'},
    {'factor': 'Recent Inquiries', 'impact': 'negative', 'desc': '2 hard inquiries in last 6 months'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Credit Score')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Score gauge
        Card(child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [
          Stack(alignment: Alignment.center, children: [
            SizedBox(width: 180, height: 180, child: CircularProgressIndicator(
              value: _score / _maxScore, strokeWidth: 12, backgroundColor: Colors.grey.shade200,
              color: _scoreColor)),
            Column(children: [
              Text('$_score', style: TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: _scoreColor)),
              Text('out of $_maxScore', style: const TextStyle(color: Colors.grey)),
              Text(_scoreLabel, style: TextStyle(fontWeight: FontWeight.bold, color: _scoreColor)),
            ]),
          ]),
          const SizedBox(height: 12),
          const Text('Source: CRC Credit Bureau', style: TextStyle(fontSize: 11, color: Colors.grey)),
          const Text('Last updated: June 1, 2026', style: TextStyle(fontSize: 11, color: Colors.grey)),
        ]))),
        const SizedBox(height: 16),
        // Trend
        const Text('Score History', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        SizedBox(height: 60, child: Row(crossAxisAlignment: CrossAxisAlignment.end,
          children: _history.reversed.map((h) => Expanded(child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
              Text('${h["score"]}', style: const TextStyle(fontSize: 10)),
              Container(height: ((h['score'] as int) - 650) * 0.8, color: Colors.green.shade300),
              Text((h['month'] as String).substring(0, 3), style: const TextStyle(fontSize: 9)),
            ]),
          ))).toList(),
        )),
        const SizedBox(height: 16),
        // Factors
        const Text('Score Factors', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        ..._factors.map((f) => ListTile(
          dense: true,
          leading: Icon(
            f['impact'] == 'positive' ? Icons.arrow_upward : f['impact'] == 'negative' ? Icons.arrow_downward : Icons.remove,
            color: f['impact'] == 'positive' ? Colors.green : f['impact'] == 'negative' ? Colors.red : Colors.grey,
          ),
          title: Text(f['factor'] as String, style: const TextStyle(fontWeight: FontWeight.w500)),
          subtitle: Text(f['desc'] as String, style: const TextStyle(fontSize: 12)),
        )),
      ]),
    );
  }

  Color get _scoreColor => _score >= 750 ? Colors.green : _score >= 650 ? Colors.amber : Colors.red;
  String get _scoreLabel => _score >= 750 ? 'Excellent' : _score >= 700 ? 'Good' : _score >= 650 ? 'Fair' : 'Poor';
}
