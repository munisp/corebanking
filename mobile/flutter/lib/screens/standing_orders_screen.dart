import 'package:flutter/material.dart';

class StandingOrdersScreen extends StatefulWidget {
  const StandingOrdersScreen({super.key});
  @override
  State<StandingOrdersScreen> createState() => _StandingOrdersScreenState();
}

class _StandingOrdersScreenState extends State<StandingOrdersScreen> {
  final List<Map<String, dynamic>> _orders = [
    {'beneficiary': 'Landlord - Adekunle', 'amount': 500000, 'frequency': 'Monthly', 'nextDate': '2024-02-01', 'active': true},
    {'beneficiary': 'DSTV Subscription', 'amount': 21000, 'frequency': 'Monthly', 'nextDate': '2024-02-05', 'active': true},
    {'beneficiary': 'Savings Goal - Holiday', 'amount': 100000, 'frequency': 'Weekly', 'nextDate': '2024-02-02', 'active': true},
    {'beneficiary': 'School Fees - LASU', 'amount': 250000, 'frequency': 'Quarterly', 'nextDate': '2024-04-01', 'active': false},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Standing Orders')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {}, icon: const Icon(Icons.add), label: const Text('New Order')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _orders.length,
        itemBuilder: (ctx, i) {
          final o = _orders[i];
          return Card(child: SwitchListTile(
            secondary: CircleAvatar(child: Text(o['beneficiary'][0])),
            title: Text(o['beneficiary']),
            subtitle: Text('\u20A6${(o["amount"] / 100).toStringAsFixed(0)} | ${o["frequency"]} | Next: ${o["nextDate"]}'),
            value: o['active'],
            onChanged: (v) => setState(() => o['active'] = v),
          ));
        },
      ),
    );
  }
}
