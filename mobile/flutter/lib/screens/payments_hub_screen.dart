import 'package:flutter/material.dart';

/// Payments Hub — Central dashboard for all payment methods and quick actions
class PaymentsHubScreen extends StatefulWidget {
  const PaymentsHubScreen({super.key});
  @override
  State<PaymentsHubScreen> createState() => _PaymentsHubScreenState();
}

class _PaymentsHubScreenState extends State<PaymentsHubScreen> {
  final _recentPayments = [
    {'merchant': 'MTN Nigeria', 'amount': 5000, 'type': 'Airtime', 'time': '2 hours ago'},
    {'merchant': 'EKEDC', 'amount': 15000, 'type': 'Electricity', 'time': 'Yesterday'},
    {'merchant': 'DSTV', 'amount': 29500, 'type': 'Cable TV', 'time': '3 days ago'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Payments'), elevation: 0),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Quick actions grid
            Container(
              padding: const EdgeInsets.all(20),
              color: Theme.of(context).primaryColor.withOpacity(0.05),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Quick Actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 4,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 16,
                    children: [
                      _quickAction(Icons.send, 'Transfer', Colors.blue),
                      _quickAction(Icons.qr_code, 'QR Pay', Colors.green),
                      _quickAction(Icons.phone_android, 'Airtime', Colors.orange),
                      _quickAction(Icons.bolt, 'Electric', Colors.amber),
                      _quickAction(Icons.tv, 'Cable TV', Colors.purple),
                      _quickAction(Icons.wifi, 'Internet', Colors.indigo),
                      _quickAction(Icons.water_drop, 'Water', Colors.cyan),
                      _quickAction(Icons.more_horiz, 'More', Colors.grey),
                    ],
                  ),
                ],
              ),
            ),
            // Scheduled payments
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('Upcoming Bills', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    TextButton(onPressed: () {}, child: const Text('See All')),
                  ]),
                  Card(child: Column(children: [
                    ListTile(leading: const Icon(Icons.bolt, color: Colors.amber), title: const Text('EKEDC'), subtitle: const Text('Due: Jun 15'), trailing: const Text('₦15,000', style: TextStyle(fontWeight: FontWeight.bold))),
                    const Divider(height: 1),
                    ListTile(leading: const Icon(Icons.tv, color: Colors.purple), title: const Text('DSTV'), subtitle: const Text('Due: Jun 20'), trailing: const Text('₦29,500', style: TextStyle(fontWeight: FontWeight.bold))),
                  ])),
                ],
              ),
            ),
            // Recent
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Recent Payments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  ..._recentPayments.map((p) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(backgroundColor: Colors.grey.shade100, child: const Icon(Icons.receipt, color: Colors.grey)),
                    title: Text(p['merchant'] as String),
                    subtitle: Text('${p["type"]} • ${p["time"]}'),
                    trailing: Text('-₦${p["amount"]}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    onTap: () {},
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickAction(IconData icon, String label, Color color) {
    return InkWell(
      onTap: () {},
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: color),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 11), textAlign: TextAlign.center),
      ]),
    );
  }
}
