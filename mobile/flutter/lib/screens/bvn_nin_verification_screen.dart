import 'package:flutter/material.dart';

class BvnNinVerificationScreen extends StatefulWidget {
  const BvnNinVerificationScreen({super.key});
  @override
  State<BvnNinVerificationScreen> createState() => _BvnNinVerificationScreenState();
}

class _BvnNinVerificationScreenState extends State<BvnNinVerificationScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'customer': 'Adebayo M.', 'bvn': '22*******01', 'nin': '12*******45', 'bvn_status': 'Verified', 'nin_status': 'Verified', },
    {'customer': 'Chukwu E.', 'bvn': '33*******12', 'nin': 'Pending', 'bvn_status': 'Verified', 'nin_status': 'Pending', },
    {'customer': 'Ibrahim K.', 'bvn': '44*******23', 'nin': '23*******67', 'bvn_status': 'Verified', 'nin_status': 'Verified', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('BVN/NIN Verification'), backgroundColor: Colors.green[700]),
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
                        child: Text(item['customer'].toString().substring(0, 1)),
                      ),
                      title: Text(item['customer'].toString()),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    Text('BVN: ${item["bvn"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Chip(
                      label: Text(item['bvn_status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['bvn_status'] == 'Verified' ? Colors.green[100] : Colors.orange[100],
                    ),
                    Chip(
                      label: Text(item['nin_status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: item['nin_status'] == 'Verified' ? Colors.green[100] : Colors.orange[100],
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
