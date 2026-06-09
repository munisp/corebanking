import 'package:flutter/material.dart';

class KycEngineScreen extends StatefulWidget {
  const KycEngineScreen({super.key});
  @override
  State<KycEngineScreen> createState() => _KycEngineScreenState();
}

class _KycEngineScreenState extends State<KycEngineScreen> {
  final List<Map<String, dynamic>> _rules = [
    {'name': 'BVN Verification', 'provider': 'NIBSS', 'enabled': true, 'successRate': 98.5, 'avgLatency': '1.2s'},
    {'name': 'NIN Verification', 'provider': 'NIMC', 'enabled': true, 'successRate': 95.2, 'avgLatency': '2.8s'},
    {'name': 'Liveness Detection', 'provider': 'Internal ML', 'enabled': true, 'successRate': 99.1, 'avgLatency': '0.8s'},
    {'name': 'Document OCR', 'provider': 'Internal ML', 'enabled': true, 'successRate': 92.3, 'avgLatency': '1.5s'},
    {'name': 'Address Verification', 'provider': 'Youverify', 'enabled': true, 'successRate': 87.5, 'avgLatency': '24h'},
    {'name': 'Biometric Match', 'provider': 'Internal ML', 'enabled': true, 'successRate': 97.8, 'avgLatency': '0.5s'},
    {'name': 'Sanctions Screening', 'provider': 'ComplyAdvantage', 'enabled': true, 'successRate': 100.0, 'avgLatency': '0.3s'},
    {'name': 'PEP Check', 'provider': 'ComplyAdvantage', 'enabled': true, 'successRate': 100.0, 'avgLatency': '0.3s'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KYC Engine Configuration')),
      body: ListView.builder(itemCount: _rules.length, itemBuilder: (ctx, i) {
        final r = _rules[i];
        return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: SwitchListTile(
          secondary: Icon(Icons.verified_user, color: (r['enabled'] as bool) ? Colors.green : Colors.grey),
          title: Text(r['name'] as String),
          subtitle: Text('Provider: ${r["provider"]} | Success: ${r["successRate"]}% | Latency: ${r["avgLatency"]}'),
          value: r['enabled'] as bool, onChanged: (v) => setState(() => r['enabled'] = v),
        ));
      }),
    );
  }
}
