import 'package:flutter/material.dart';

class AMLTrainingTrackerScreen extends StatefulWidget {
  const AMLTrainingTrackerScreen({super.key});
  @override
  State<AMLTrainingTrackerScreen> createState() => _AMLTrainingTrackerScreenState();
}

class _AMLTrainingTrackerScreenState extends State<AMLTrainingTrackerScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'staff': 'Operations', 'module': 'CTR Filing', 'completion': '92%', 'status': 'Complete', },
    {'staff': 'Tellers', 'module': 'Suspicious Activity', 'completion': '78%', 'status': 'At Risk', },
    {'staff': 'Compliance', 'module': 'Sanctions', 'completion': '100%', 'status': 'Complete', },
    {'staff': 'Branch Mgrs', 'module': 'KYC Refresh', 'completion': '65%', 'status': 'In Progress', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AML Training Tracker'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['staff'].toString().substring(0, 1)),
                      ),
                      title: Text(item['staff'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('Module: ${item["module"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Done: ${item["completion"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['status'] == 'Complete' ? Colors.green[100] : Colors.orange[100],
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
