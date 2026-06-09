import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

/// Cards Management Screen with virtual card issuance, tokenization, and NFC
class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});
  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  final List<Map<String, dynamic>> _cards = [
    {
      'id': 'card_001',
      'type': 'virtual',
      'scheme': 'Verve',
      'last4': '4532',
      'expiry': '12/27',
      'status': 'active',
      'balance_kobo': 250000_00,
      'daily_limit_kobo': 500000_00,
      'color': Colors.blue,
    },
    {
      'id': 'card_002',
      'type': 'physical',
      'scheme': 'Mastercard',
      'last4': '8901',
      'expiry': '03/28',
      'status': 'active',
      'balance_kobo': 1500000_00,
      'daily_limit_kobo': 2000000_00,
      'color': Colors.deepPurple,
    },
  ];

  int _selectedCardIndex = 0;
  bool _showCardDetails = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Cards'), actions: [
        IconButton(icon: const Icon(Icons.add_card), onPressed: _createVirtualCard),
      ]),
      body: Column(
        children: [
          // Card carousel
          SizedBox(
            height: 220,
            child: PageView.builder(
              itemCount: _cards.length,
              onPageChanged: (i) => setState(() => _selectedCardIndex = i),
              itemBuilder: (ctx, i) => _buildCardWidget(_cards[i]),
            ),
          ),

          // Card actions
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _actionButton(Icons.lock, 'Freeze', () => _toggleFreeze()),
                _actionButton(Icons.settings, 'Limits', () => _showLimitsDialog()),
                _actionButton(Icons.visibility, 'Details', () => setState(() => _showCardDetails = !_showCardDetails)),
                _actionButton(Icons.nfc, 'NFC', () => _showNFCDialog()),
                _actionButton(Icons.delete_forever, 'Delete', () => _deleteCard()),
              ],
            ),
          ),

          // Card details (hidden by default)
          if (_showCardDetails) _buildCardDetails(_cards[_selectedCardIndex]),

          const Divider(),

          // Recent transactions for this card
          Expanded(child: _buildRecentTransactions()),
        ],
      ),
    );
  }

  Widget _buildCardWidget(Map<String, dynamic> card) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [card['color'] as Color, (card['color'] as Color).withOpacity(0.7)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(card['scheme'], style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              Text(card['type'] == 'virtual' ? 'VIRTUAL' : 'PHYSICAL',
                  style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12)),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            _showCardDetails ? '**** **** **** ${card['last4']}' : '**** **** **** ${card['last4']}',
            style: const TextStyle(color: Colors.white, fontSize: 22, letterSpacing: 3),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('EXPIRES', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 10)),
                Text(card['expiry'], style: const TextStyle(color: Colors.white, fontSize: 14)),
              ]),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('BALANCE', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 10)),
                Text('\u20A6${_formatKobo(card['balance_kobo'] as int)}',
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
              ]),
              if (card['status'] == 'frozen')
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
                  child: const Text('FROZEN', style: TextStyle(color: Colors.white, fontSize: 10)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCardDetails(Map<String, dynamic> card) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _detailRow('Card Number', '**** **** **** ${card['last4']}'),
            _detailRow('Expiry', card['expiry']),
            _detailRow('CVV', '***'),
            _detailRow('Status', card['status']),
            _detailRow('Daily Limit', '\u20A6${_formatKobo(card['daily_limit_kobo'] as int)}'),
            _detailRow('Type', card['type']),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(color: Colors.grey)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
      ]),
    );
  }

  Widget _actionButton(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
          child: Icon(icon, size: 20),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 11)),
      ]),
    );
  }

  Widget _buildRecentTransactions() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        ListTile(leading: Icon(Icons.shopping_bag), title: Text('Shoprite Ikeja'), subtitle: Text('Today, 2:30 PM'), trailing: Text('-\u20A612,500', style: TextStyle(color: Colors.red))),
        ListTile(leading: Icon(Icons.local_gas_station), title: Text('Total Energies'), subtitle: Text('Yesterday'), trailing: Text('-\u20A68,000', style: TextStyle(color: Colors.red))),
        ListTile(leading: Icon(Icons.restaurant), title: Text('Chicken Republic'), subtitle: Text('Mon, 4:15 PM'), trailing: Text('-\u20A63,200', style: TextStyle(color: Colors.red))),
      ],
    );
  }

  void _toggleFreeze() {
    setState(() {
      final card = _cards[_selectedCardIndex];
      card['status'] = card['status'] == 'frozen' ? 'active' : 'frozen';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Card ${_cards[_selectedCardIndex]['status'] == 'frozen' ? 'frozen' : 'unfrozen'}')),
    );
  }

  void _showLimitsDialog() {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Card Limits'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Daily Transaction Limit'),
        Slider(value: 500000, min: 10000, max: 5000000, divisions: 50, onChanged: (v) {}),
        const Text('ATM Withdrawal Limit'),
        Slider(value: 200000, min: 10000, max: 500000, divisions: 50, onChanged: (v) {}),
        SwitchListTile(title: const Text('Online Purchases'), value: true, onChanged: (v) {}),
        SwitchListTile(title: const Text('POS Payments'), value: true, onChanged: (v) {}),
        SwitchListTile(title: const Text('International'), value: false, onChanged: (v) {}),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Save'))],
    ));
  }

  void _showNFCDialog() {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      icon: const Icon(Icons.nfc, size: 48, color: Colors.blue),
      title: const Text('NFC Payment'),
      content: const Text('Hold your phone near the payment terminal.\n\nTokenized card data will be transmitted securely.'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))],
    ));
  }

  void _createVirtualCard() {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Create Virtual Card'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Instantly create a virtual card for online purchases.'),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          decoration: const InputDecoration(labelText: 'Card Scheme'),
          items: const [
            DropdownMenuItem(value: 'verve', child: Text('Verve')),
            DropdownMenuItem(value: 'mastercard', child: Text('Mastercard')),
            DropdownMenuItem(value: 'visa', child: Text('Visa')),
          ],
          onChanged: (v) {},
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ElevatedButton(onPressed: () { Navigator.pop(ctx); _addNewCard(); }, child: const Text('Create')),
      ],
    ));
  }

  void _addNewCard() {
    setState(() {
      _cards.add({
        'id': 'card_${_cards.length + 1}',
        'type': 'virtual', 'scheme': 'Verve', 'last4': '${1000 + _cards.length}',
        'expiry': '06/29', 'status': 'active', 'balance_kobo': 0, 'daily_limit_kobo': 200000_00, 'color': Colors.teal,
      });
    });
  }

  void _deleteCard() {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Delete Card?'),
      content: const Text('This action cannot be undone. Any remaining balance will be returned to your main account.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () { Navigator.pop(ctx); setState(() => _cards.removeAt(_selectedCardIndex)); },
            child: const Text('Delete')),
      ],
    ));
  }

  String _formatKobo(int kobo) {
    final naira = kobo ~/ 100;
    return naira.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }
}
