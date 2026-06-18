import 'package:flutter/material.dart';

class CardManagementScreen extends StatefulWidget {
  const CardManagementScreen({super.key});
  @override
  State<CardManagementScreen> createState() => _CardManagementScreenState();
}

class _CardManagementScreenState extends State<CardManagementScreen> {
  final List<Map<String, dynamic>> _cards = [
    {'type': 'Debit', 'network': 'Verve', 'last4': '4521', 'expiry': '09/26', 'status': 'active', 'color': Colors.blue},
    {'type': 'Credit', 'network': 'Mastercard', 'last4': '8834', 'expiry': '03/27', 'status': 'active', 'color': Colors.purple},
    {'type': 'Prepaid', 'network': 'Visa', 'last4': '1122', 'expiry': '12/25', 'status': 'frozen', 'color': Colors.grey},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Card Management')),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add_card)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        SizedBox(height: 200, child: PageView.builder(
          itemCount: _cards.length,
          controller: PageController(viewportFraction: 0.9),
          itemBuilder: (ctx, i) => _buildCardWidget(_cards[i]),
        )),
        const SizedBox(height: 24),
        const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Wrap(spacing: 12, runSpacing: 12, children: [
          _actionChip(Icons.lock, 'Freeze Card'),
          _actionChip(Icons.pin, 'Change PIN'),
          _actionChip(Icons.credit_card_off, 'Block Card'),
          _actionChip(Icons.travel_explore, 'Travel Mode'),
          _actionChip(Icons.money, 'Set Limits'),
          _actionChip(Icons.contactless, 'NFC Toggle'),
          _actionChip(Icons.receipt_long, 'Transactions'),
          _actionChip(Icons.add_card, 'Virtual Card'),
        ]),
        const SizedBox(height: 24),
        const Text('Card Controls', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        SwitchListTile(title: const Text('Online Transactions'), value: true, onChanged: (v) {}),
        SwitchListTile(title: const Text('International'), value: false, onChanged: (v) {}),
        SwitchListTile(title: const Text('ATM Withdrawals'), value: true, onChanged: (v) {}),
        SwitchListTile(title: const Text('POS Payments'), value: true, onChanged: (v) {}),
        SwitchListTile(title: const Text('Contactless (NFC)'), value: true, onChanged: (v) {}),
      ]),
    );
  }

  Widget _buildCardWidget(Map<String, dynamic> card) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 4),
    decoration: BoxDecoration(
      color: card['color'], borderRadius: BorderRadius.circular(16),
      gradient: LinearGradient(colors: [card['color'], card['color'].withOpacity(0.7)]),
    ),
    padding: const EdgeInsets.all(24),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(card['network'], style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const Spacer(),
        if (card['status'] == 'frozen') const Icon(Icons.ac_unit, color: Colors.white),
      ]),
      const Spacer(),
      Text('**** **** **** ${card["last4"]}', style: const TextStyle(color: Colors.white, fontSize: 20, letterSpacing: 2)),
      const SizedBox(height: 8),
      Row(children: [
        Text('${card["type"]}', style: const TextStyle(color: Colors.white70)),
        const Spacer(),
        Text('EXP ${card["expiry"]}', style: const TextStyle(color: Colors.white70)),
      ]),
    ]),
  );

  Widget _actionChip(IconData icon, String label) => ActionChip(
    avatar: Icon(icon, size: 18), label: Text(label), onPressed: () {});
}
