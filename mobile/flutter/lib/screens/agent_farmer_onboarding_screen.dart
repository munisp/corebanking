import 'package:flutter/material.dart';

class AgentFarmerOnboardingScreen extends StatefulWidget {
  const AgentFarmerOnboardingScreen({super.key});
  @override
  State<AgentFarmerOnboardingScreen> createState() => _AgentFarmerOnboardingScreenState();
}

class _AgentFarmerOnboardingScreenState extends State<AgentFarmerOnboardingScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'farmer': 'Abdullahi Musa', 'farm': 'Rice 5ha', 'agent': 'AGT-001', 'status': 'Verified', },
    {'farmer': 'Blessing Okafor', 'farm': 'Cassava 3ha', 'agent': 'AGT-003', 'status': 'Pending', },
    {'farmer': 'Emeka Nwachukwu', 'farm': 'Maize 8ha', 'agent': 'AGT-002', 'status': 'Verified', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agent Farmer Onboarding'), backgroundColor: Colors.green[700]),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              decoration: InputDecoration(
                hintText: 'Search...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView.builder(
                itemCount: _filteredItems.length,
                itemBuilder: (context, index) {
                  final item = _filteredItems[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Colors.green[100],
                        child: Text(item['farmer'].toString().substring(0, 1)),
                      ),
                      title: Text(item['farmer'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Farm: ${item["farm"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Agent: ${item["agent"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Verified' ? Colors.green[100] : Colors.orange[100],
                    ),
                        ],
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {},
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
