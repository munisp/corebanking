import 'package:flutter/material.dart';

class AddressVerificationScreen extends StatefulWidget {
  const AddressVerificationScreen({super.key});
  @override
  State<AddressVerificationScreen> createState() => _AddressVerificationScreenState();
}

class _AddressVerificationScreenState extends State<AddressVerificationScreen> {
  String _searchQuery = '';
  final List<Map<String, dynamic>> _items = [
    {'customer': 'Adebayo M.', 'address': '12 Broad St, Lagos', 'method': 'Utility Bill', 'status': 'Verified', },
    {'customer': 'Chukwu E.', 'address': '45 Aminu Kano, Abuja', 'method': 'Field Visit', 'status': 'Pending', },
    {'customer': 'Ibrahim K.', 'address': '78 Ahmadu Bello, Kaduna', 'method': 'GPS', 'status': 'Verified', },
    {'customer': 'Okonkwo N.', 'address': '3 Trans Amadi, PH', 'method': 'Bank Statement', 'status': 'Failed', },
  ];

  List<Map<String, dynamic>> get _filteredItems => _searchQuery.isEmpty
      ? _items
      : _items.where((i) => i.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Address Verification'), backgroundColor: Colors.green[700]),
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
                    Text('Address: ${item["address"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                    Text('Method: ${item["method"]}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
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
