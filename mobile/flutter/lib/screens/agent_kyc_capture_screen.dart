import 'package:flutter/material.dart';

class AgentKycCaptureScreen extends StatefulWidget {
  const AgentKycCaptureScreen({super.key});
  @override
  State<AgentKycCaptureScreen> createState() => _AgentKycCaptureScreenState();
}

class _AgentKycCaptureScreenState extends State<AgentKycCaptureScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'agent': 'AGT-001', 'name': 'Musa Danjuma', 'captures': 45, 'verified': 42, 'status': 'Active', },
    {'agent': 'AGT-002', 'name': 'Grace Obi', 'captures': 38, 'verified': 35, 'status': 'Active', },
    {'agent': 'AGT-003', 'name': 'Yusuf Ibrahim', 'captures': 52, 'verified': 50, 'status': 'Active', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agent KYC Capture'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['agent'].toString().substring(0, 1)),
                      ),
                      title: Text(item['agent'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Name: ${item["name"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Captures: ${item["captures"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Active' ? Colors.green[100] : Colors.orange[100],
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
