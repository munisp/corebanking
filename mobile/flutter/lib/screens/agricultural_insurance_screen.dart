import 'package:flutter/material.dart';

class AgriculturalInsuranceScreen extends StatefulWidget {
  const AgriculturalInsuranceScreen({super.key});
  @override
  State<AgriculturalInsuranceScreen> createState() => _AgriculturalInsuranceScreenState();
}

class _AgriculturalInsuranceScreenState extends State<AgriculturalInsuranceScreen> {
  final List<Map<String, dynamic>> _products = [
    {'name': 'Crop Insurance (NAIC)', 'coverage': 'Drought, Flood, Pest', 'premium': '2.5% of sum insured', 'subsidy': '50% CBN/FGN', 'maxCover': 5000000},
    {'name': 'Weather Index Insurance', 'coverage': 'Rainfall deviation', 'premium': '3.0%', 'subsidy': '40% State Govt', 'maxCover': 3000000},
    {'name': 'Livestock Insurance', 'coverage': 'Disease, Theft, Death', 'premium': '4.5%', 'subsidy': '30%', 'maxCover': 10000000},
    {'name': 'Fishery Insurance', 'coverage': 'Flood, Disease, Equipment', 'premium': '3.5%', 'subsidy': '35%', 'maxCover': 2000000},
    {'name': 'Area Yield Index', 'coverage': 'Below-average yield', 'premium': '2.0%', 'subsidy': '50%', 'maxCover': 8000000},
  ];

  final List<Map<String, String>> _activePolicies = [
    {'id': 'AIP-2024-001', 'farmer': 'Adamu Musa', 'crop': 'Rice (50 hectares)', 'cover': '₦25,000,000', 'status': 'Active', 'expiry': '2024-10-31'},
    {'id': 'AIP-2024-002', 'farmer': 'Ibrahim Cattle Ranch', 'crop': 'Livestock (200 heads)', 'cover': '₦10,000,000', 'status': 'Active', 'expiry': '2024-12-31'},
    {'id': 'AIP-2024-003', 'farmer': 'Cooperative Rice Cluster', 'crop': 'Rice (500 hectares)', 'cover': '₦120,000,000', 'status': 'Claim Filed', 'expiry': '2024-10-31'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agricultural Insurance'), backgroundColor: Colors.green[800]),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Insurance Products', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ...(_products.map((p) => Card(child: ListTile(
          leading: const Icon(Icons.shield, color: Colors.green),
          title: Text(p['name'] as String), subtitle: Text('Coverage: ${p["coverage"]}\nPremium: ${p["premium"]} | Subsidy: ${p["subsidy"]} | Max: ₦${((p["maxCover"] as int) / 1000000).toStringAsFixed(0)}M'),
          isThreeLine: true, trailing: ElevatedButton(onPressed: () {}, child: const Text('Apply')),
        )))),
        const SizedBox(height: 16),
        const Text('Active Policies', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ...(_activePolicies.map((p) => Card(child: ListTile(
          leading: Icon(Icons.policy, color: p['status'] == 'Active' ? Colors.green : Colors.orange),
          title: Text('${p["id"]} - ${p["farmer"]}'), subtitle: Text('${p["crop"]} | Cover: ${p["cover"]} | Expiry: ${p["expiry"]}'),
          trailing: Chip(label: Text(p['status']!), backgroundColor: p['status'] == 'Active' ? Colors.green[100] : Colors.orange[100]),
        )))),
      ])),
    );
  }
}
