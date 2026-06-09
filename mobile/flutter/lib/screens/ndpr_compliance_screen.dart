import 'package:flutter/material.dart';

class NdprComplianceScreen extends StatefulWidget {
  const NdprComplianceScreen({super.key});
  @override
  State<NdprComplianceScreen> createState() => _NdprComplianceScreenState();
}

class _NdprComplianceScreenState extends State<NdprComplianceScreen> {
  final List<Map<String, dynamic>> _requirements = [
    {'name': 'Data Processing Lawfulness', 'status': 'Compliant', 'score': 95, 'lastAudit': '2024-01-10'},
    {'name': 'Consent Management', 'status': 'Compliant', 'score': 88, 'lastAudit': '2024-01-10'},
    {'name': 'Data Breach Notification', 'status': 'Compliant', 'score': 92, 'lastAudit': '2024-01-10'},
    {'name': 'Data Subject Rights', 'status': 'Partial', 'score': 75, 'lastAudit': '2024-01-10'},
    {'name': 'Cross-Border Transfer', 'status': 'Compliant', 'score': 90, 'lastAudit': '2024-01-10'},
    {'name': 'Data Protection Impact Assessment', 'status': 'Partial', 'score': 70, 'lastAudit': '2024-01-10'},
    {'name': 'DPO Appointment', 'status': 'Compliant', 'score': 100, 'lastAudit': '2024-01-10'},
    {'name': 'Record of Processing', 'status': 'Compliant', 'score': 85, 'lastAudit': '2024-01-10'},
  ];

  @override
  Widget build(BuildContext context) {
    final avgScore = _requirements.fold<int>(0, (s, r) => s + (r['score'] as int)) ~/ _requirements.length;
    return Scaffold(
      appBar: AppBar(title: const Text('NDPR Compliance'), backgroundColor: Colors.purple[800]),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(20), color: Colors.purple[50], child: Row(children: [
          Expanded(child: Column(children: [
            Text('$avgScore%', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: avgScore >= 80 ? Colors.green : Colors.orange)),
            const Text('Overall Score', style: TextStyle(color: Colors.grey)),
          ])),
          Expanded(child: Column(children: [
            Text('${_requirements.where((r) => r["status"] == "Compliant").length}/${_requirements.length}', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
            const Text('Requirements Met', style: TextStyle(color: Colors.grey)),
          ])),
        ])),
        Expanded(child: ListView.builder(itemCount: _requirements.length, itemBuilder: (ctx, i) {
          final r = _requirements[i];
          final color = r['status'] == 'Compliant' ? Colors.green : Colors.orange;
          return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: ListTile(
            leading: CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Text('${r["score"]}', style: TextStyle(color: color, fontWeight: FontWeight.bold))),
            title: Text(r['name'] as String), subtitle: Text('Last audit: ${r["lastAudit"]}'),
            trailing: Chip(label: Text(r['status'] as String), backgroundColor: color.withOpacity(0.1)),
          ));
        })),
      ]),
    );
  }
}
