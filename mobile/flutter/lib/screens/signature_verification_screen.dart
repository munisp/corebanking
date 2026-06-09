import 'package:flutter/material.dart';

class SignatureVerificationScreen extends StatefulWidget {
  const SignatureVerificationScreen({super.key});
  @override
  State<SignatureVerificationScreen> createState() => _SignatureVerificationScreenState();
}

class _SignatureVerificationScreenState extends State<SignatureVerificationScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'name': 'Cheque Signature Check', 'type': 'Image Matching', 'value': '15K/day', 'status': 'Active'},
    {'name': 'Mandate Card Verification', 'type': 'Reference Match', 'value': '5K/day', 'status': 'Active'},
    {'name': 'High-Value Txn Signature', 'type': 'Dual Sign (>₦10M)', 'value': '2K/day', 'status': 'Active'},
    {'name': 'Corporate Resolution Verify', 'type': 'Board Signatories', 'value': '500/day', 'status': 'Active'},
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  Widget _kpi(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.green[700], size: 20),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Signature Verification'), backgroundColor: Colors.green[700]),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
              _kpi('Verified Today', '25K', Icons.draw),
              _kpi('Mismatches', '120', Icons.warning),
              _kpi('Auto-Match Rate', '92%', Icons.auto_awesome),
              _kpi('Manual Queue', '450', Icons.person_search),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search signature verification...',
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
                        child: Text(item['name'].toString().substring(0, 1)),
                      ),
                      title: Text(item['name'].toString()),
                      subtitle: Text('${item['type']} — ${item['value']}'),
                      trailing: Chip(
                        label: Text(item['status'].toString(), style: const TextStyle(fontSize: 12)),
                        backgroundColor: item['status'] == 'Active' ? Colors.green[100] : Colors.orange[100],
                      ),
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
