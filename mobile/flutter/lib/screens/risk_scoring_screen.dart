import 'package:flutter/material.dart';

class RiskScoringScreen extends StatefulWidget {
  const RiskScoringScreen({super.key});
  @override
  State<RiskScoringScreen> createState() => _RiskScoringScreenState();
}

class _RiskScoringScreenState extends State<RiskScoringScreen> {
  final List<Map<String, dynamic>> _customers = [
    {'name': 'ABC Holdings Ltd', 'score': 85, 'tier': 'High Risk', 'factors': ['PEP connection', 'High-value cash', 'Multiple jurisdictions']},
    {'name': 'John Okeke', 'score': 45, 'tier': 'Medium Risk', 'factors': ['New account', 'Inconsistent income']},
    {'name': 'Grace Eze', 'score': 15, 'tier': 'Low Risk', 'factors': ['Salary earner', 'Long relationship']},
    {'name': 'XYZ Imports', 'score': 72, 'tier': 'High Risk', 'factors': ['Trade-based laundering indicators', 'Round-tripping']},
    {'name': 'Fatima Abdullahi', 'score': 25, 'tier': 'Low Risk', 'factors': ['Government employee', 'Stable pattern']},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Risk Scoring')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _customers.length,
        itemBuilder: (ctx, i) {
          final c = _customers[i];
          Color riskColor = c['score'] > 70 ? Colors.red : c['score'] > 40 ? Colors.orange : Colors.green;
          return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(child: Text(c['name'], style: const TextStyle(fontWeight: FontWeight.bold))),
                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: riskColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                  child: Text('${c["score"]}/100', style: TextStyle(color: riskColor, fontWeight: FontWeight.bold))),
              ]),
              const SizedBox(height: 4),
              Text(c['tier'], style: TextStyle(color: riskColor)),
              const SizedBox(height: 8),
              Wrap(spacing: 4, children: (c['factors'] as List).map((f) =>
                Chip(label: Text(f, style: const TextStyle(fontSize: 10)),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap)).toList()),
            ],
          )));
        },
      ),
    );
  }
}
