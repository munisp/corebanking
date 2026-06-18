import 'package:flutter/material.dart';

class CreditScoringScreen extends StatefulWidget {
  const CreditScoringScreen({super.key});
  @override
  State<CreditScoringScreen> createState() => _CreditScoringScreenState();
}

class _CreditScoringScreenState extends State<CreditScoringScreen> {
  final Map<String, dynamic> _scoreData = {
    'score': 745, 'max': 850, 'band': 'Good',
    'factors': [
      {'name': 'Payment History', 'weight': 35, 'score': 92, 'impact': 'positive'},
      {'name': 'Credit Utilization', 'weight': 30, 'score': 65, 'impact': 'neutral'},
      {'name': 'Account Age', 'weight': 15, 'score': 88, 'impact': 'positive'},
      {'name': 'Credit Mix', 'weight': 10, 'score': 70, 'impact': 'neutral'},
      {'name': 'Recent Inquiries', 'weight': 10, 'score': 55, 'impact': 'negative'},
    ],
    'trend': [680, 695, 710, 720, 735, 745],
  };

  @override
  Widget build(BuildContext context) {
    double pct = _scoreData['score'] / _scoreData['max'];
    Color scoreColor = pct > 0.8 ? Colors.green : pct > 0.6 ? Colors.blue : pct > 0.4 ? Colors.orange : Colors.red;
    return Scaffold(
      appBar: AppBar(title: const Text('Credit Score')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Card(child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [
            Stack(alignment: Alignment.center, children: [
              SizedBox(width: 140, height: 140, child: CircularProgressIndicator(
                value: pct, strokeWidth: 12, backgroundColor: Colors.grey.shade200, color: scoreColor)),
              Column(children: [
                Text('${_scoreData["score"]}', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: scoreColor)),
                Text(_scoreData['band'], style: const TextStyle(fontSize: 14, color: Colors.grey)),
              ]),
            ]),
            const SizedBox(height: 16),
            const Text('CRC Credit Bureau', style: TextStyle(color: Colors.grey)),
          ]))),
          const SizedBox(height: 16),
          const Align(alignment: Alignment.centerLeft,
            child: Text('Score Factors', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
          const SizedBox(height: 8),
          ...(_scoreData['factors'] as List).map((f) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('${f["name"]} (${f["weight"]}%)')),
                Icon(f['impact'] == 'positive' ? Icons.trending_up : f['impact'] == 'negative' ? Icons.trending_down : Icons.trending_flat,
                  color: f['impact'] == 'positive' ? Colors.green : f['impact'] == 'negative' ? Colors.red : Colors.grey, size: 18),
                const SizedBox(width: 8),
                Text('${f["score"]}%'),
              ]),
              const SizedBox(height: 4),
              LinearProgressIndicator(value: f['score'] / 100, backgroundColor: Colors.grey.shade200,
                color: f['score'] > 80 ? Colors.green : f['score'] > 60 ? Colors.blue : Colors.orange),
            ]),
          )),
          const SizedBox(height: 24),
          const Align(alignment: Alignment.centerLeft,
            child: Text('6-Month Trend', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
          const SizedBox(height: 8),
          SizedBox(height: 80, child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: (_scoreData['trend'] as List).map((s) => Column(mainAxisAlignment: MainAxisAlignment.end, children: [
              Text('$s', style: const TextStyle(fontSize: 10)),
              const SizedBox(height: 2),
              Container(width: 30, height: (s - 600) * 0.5, color: Colors.blue.shade300),
            ])).toList(),
          )),
          const SizedBox(height: 16),
          Card(color: Colors.green.shade50, child: const ListTile(
            leading: Icon(Icons.lightbulb, color: Colors.green),
            title: Text('Tip: Reduce credit utilization below 30% to improve score'),
          )),
        ]),
      ),
    );
  }
}
