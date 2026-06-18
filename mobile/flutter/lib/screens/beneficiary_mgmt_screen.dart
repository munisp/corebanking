import 'package:flutter/material.dart';

class BeneficiaryMgmtScreen extends StatefulWidget {
  const BeneficiaryMgmtScreen({super.key});
  @override
  State<BeneficiaryMgmtScreen> createState() => _BeneficiaryMgmtScreenState();
}

class _BeneficiaryMgmtScreenState extends State<BeneficiaryMgmtScreen> {
  final List<Map<String, dynamic>> _beneficiaries = [
    {'name': 'Adebayo Ogunlesi', 'bank': 'GTBank', 'account': '0012345678', 'nickname': 'Bayo - Rent', 'frequent': true},
    {'name': 'Chioma Nwosu', 'bank': 'Access Bank', 'account': '1234567890', 'nickname': 'Chi - Supplies', 'frequent': true},
    {'name': 'Emeka Okafor', 'bank': 'Zenith Bank', 'account': '2098765432', 'nickname': 'Emeka - Driver', 'frequent': false},
    {'name': 'Fatima Abdullahi', 'bank': 'First Bank', 'account': '3012345678', 'nickname': 'Fatima - School fees', 'frequent': false},
    {'name': 'Gbenga Afolabi', 'bank': 'UBA', 'account': '2112345678', 'nickname': 'Gbenga - Gym', 'frequent': true},
  ];

  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _beneficiaries.where((b) =>
      b['name'].toLowerCase().contains(_searchQuery.toLowerCase()) ||
      b['nickname'].toLowerCase().contains(_searchQuery.toLowerCase())
    ).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Beneficiaries')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddBeneficiary(context),
        icon: const Icon(Icons.person_add),
        label: const Text('Add'),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            onChanged: (v) => setState(() => _searchQuery = v),
            decoration: InputDecoration(
              hintText: 'Search beneficiaries...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        Expanded(child: ListView.builder(
          itemCount: filtered.length,
          itemBuilder: (ctx, i) {
            final b = filtered[i];
            return Dismissible(
              key: Key(b['account']),
              direction: DismissDirection.endToStart,
              background: Container(color: Colors.red, alignment: Alignment.centerRight,
                padding: const EdgeInsets.only(right: 16), child: const Icon(Icons.delete, color: Colors.white)),
              onDismissed: (_) => setState(() => _beneficiaries.remove(b)),
              child: ListTile(
                leading: CircleAvatar(child: Text(b['name'][0])),
                title: Text(b['nickname']),
                subtitle: Text('${b["bank"]} - ${b["account"]}'),
                trailing: b['frequent'] ? const Icon(Icons.star, color: Colors.amber) : null,
                onTap: () {},
              ),
            );
          },
        )),
      ]),
    );
  }

  void _showAddBeneficiary(BuildContext context) {
    showModalBottomSheet(context: context, isScrollControlled: true, builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Add Beneficiary', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        const TextField(decoration: InputDecoration(labelText: 'Account Number', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        const TextField(decoration: InputDecoration(labelText: 'Bank Name', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        const TextField(decoration: InputDecoration(labelText: 'Nickname (optional)', border: OutlineInputBorder())),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: () => Navigator.pop(ctx), child: const Text('Verify & Save'))),
        const SizedBox(height: 24),
      ]),
    ));
  }
}
