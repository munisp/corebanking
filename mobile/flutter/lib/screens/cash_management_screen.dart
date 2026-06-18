import 'package:flutter/material.dart';

class CashManagementScreen extends StatefulWidget {
  const CashManagementScreen({super.key});
  @override
  State<CashManagementScreen> createState() => _CashManagementScreenState();
}

class _CashManagementScreenState extends State<CashManagementScreen> {
  final Map<String, dynamic> _vaultStatus = {
    'total_cash': 2500000000, 'denominations': {
      '1000': 850000, '500': 420000, '200': 315000, '100': 210000, '50': 95000, '20': 45000,
    },
  };

  final List<Map<String, dynamic>> _movements = [
    {'type': 'ATM Replenishment', 'branch': 'VI Branch', 'amount': 50000000, 'direction': 'out', 'time': '09:30'},
    {'type': 'Cash Deposit', 'branch': 'Ikeja', 'amount': 125000000, 'direction': 'in', 'time': '10:15'},
    {'type': 'CBN Cash Swap', 'branch': 'Head Office', 'amount': 200000000, 'direction': 'in', 'time': '11:00'},
    {'type': 'Teller Drawer', 'branch': 'Lekki', 'amount': 15000000, 'direction': 'out', 'time': '08:45'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cash Management')),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            const Text('Vault Balance', style: TextStyle(color: Colors.grey)),
            Text('\u20A6${(_vaultStatus["total_cash"] / 100000000).toStringAsFixed(1)}M',
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
          ]))),
          const SizedBox(height: 16),
          const Text('Today\'s Movements', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ...List.generate(_movements.length, (i) {
            final m = _movements[i];
            bool isIn = m['direction'] == 'in';
            return ListTile(
              leading: Icon(isIn ? Icons.arrow_downward : Icons.arrow_upward, color: isIn ? Colors.green : Colors.red),
              title: Text(m['type']),
              subtitle: Text('${m["branch"]} | ${m["time"]}'),
              trailing: Text('${isIn ? "+" : "-"}\u20A6${(m["amount"] / 100000).toStringAsFixed(0)}K',
                style: TextStyle(color: isIn ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
            );
          }),
        ],
      )),
    );
  }
}
