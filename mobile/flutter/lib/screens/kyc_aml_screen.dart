import 'package:flutter/material.dart';

class KycAmlScreen extends StatefulWidget {
  const KycAmlScreen({super.key});
  @override
  State<KycAmlScreen> createState() => _KycAmlScreenState();
}

class _KycAmlScreenState extends State<KycAmlScreen> {
  final List<Map<String, dynamic>> _pendingCases = [
    {'id': 'KYC-5501', 'customer': 'Adamu Bello', 'type': 'Tier 3 Upgrade', 'risk': 'medium', 'submitted': '2024-01-25', 'docs': 3},
    {'id': 'KYC-5502', 'customer': 'Ngozi Obi', 'type': 'Enhanced Due Diligence', 'risk': 'high', 'submitted': '2024-01-24', 'docs': 5},
    {'id': 'KYC-5503', 'customer': 'Hassan Yusuf', 'type': 'PEP Screening', 'risk': 'critical', 'submitted': '2024-01-23', 'docs': 2},
    {'id': 'KYC-5504', 'customer': 'Grace Eze', 'type': 'Address Verification', 'risk': 'low', 'submitted': '2024-01-26', 'docs': 1},
  ];

  final Map<String, int> _stats = {
    'Pending': 45, 'In Review': 23, 'Approved': 1204, 'Rejected': 18, 'Escalated': 7,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KYC/AML Management'), actions: [
        IconButton(icon: const Icon(Icons.filter_list), onPressed: () {}),
      ]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(height: 60, child: ListView(scrollDirection: Axis.horizontal, children:
            _stats.entries.map((e) => Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Chip(label: Text('${e.key}: ${e.value}'), backgroundColor: Colors.blue.shade50),
            )).toList(),
          )),
          const SizedBox(height: 16),
          const Text('Pending Cases', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...List.generate(_pendingCases.length, (i) {
            final c = _pendingCases[i];
            Color riskColor = c['risk'] == 'critical' ? Colors.red : c['risk'] == 'high' ? Colors.orange
              : c['risk'] == 'medium' ? Colors.amber : Colors.green;
            return Card(child: ListTile(
              leading: CircleAvatar(backgroundColor: riskColor.withOpacity(0.2),
                child: Icon(Icons.person_search, color: riskColor)),
              title: Text('${c["customer"]} (${c["id"]})'),
              subtitle: Text('${c["type"]} | ${c["docs"]} docs | ${c["submitted"]}'),
              trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: riskColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                child: Text(c['risk'].toUpperCase(), style: TextStyle(color: riskColor, fontSize: 11, fontWeight: FontWeight.bold))),
              onTap: () {},
            ));
          }),
        ]),
      ),
    );
  }
}
