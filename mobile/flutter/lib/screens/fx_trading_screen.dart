import 'package:flutter/material.dart';

/// FX Trading — Foreign exchange with CBN rates, P2P marketplace, and remittance
class FxTradingScreen extends StatefulWidget {
  const FxTradingScreen({super.key});
  @override
  State<FxTradingScreen> createState() => _FxTradingScreenState();
}

class _FxTradingScreenState extends State<FxTradingScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _fromCurrency = 'NGN';
  String _toCurrency = 'USD';
  final _amountController = TextEditingController();
  double? _convertedAmount;

  final _rates = {
    'USD': {'buy': 1550.0, 'sell': 1580.0, 'cbn': 1505.0},
    'GBP': {'buy': 1950.0, 'sell': 1990.0, 'cbn': 1900.0},
    'EUR': {'buy': 1680.0, 'sell': 1720.0, 'cbn': 1640.0},
    'GHS': {'buy': 95.0, 'sell': 100.0, 'cbn': 92.0},
    'KES': {'buy': 11.5, 'sell': 12.0, 'cbn': 11.0},
    'ZAR': {'buy': 82.0, 'sell': 86.0, 'cbn': 80.0},
  };

  @override
  void initState() { super.initState(); _tabController = TabController(length: 3, vsync: this); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FX Trading'), bottom: TabBar(controller: _tabController, tabs: const [
        Tab(text: 'Convert'), Tab(text: 'Rates'), Tab(text: 'P2P'),
      ])),
      body: TabBarView(controller: _tabController, children: [_convertTab(), _ratesTab(), _p2pTab()]),
    );
  }

  Widget _convertTab() => SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      // From
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('You Send', style: TextStyle(color: Colors.grey)),
        Row(children: [
          Expanded(child: TextField(controller: _amountController, keyboardType: TextInputType.number, style: const TextStyle(fontSize: 24),
            decoration: const InputDecoration(border: InputBorder.none, hintText: '0.00'), onChanged: (_) => _convert())),
          DropdownButton<String>(value: _fromCurrency, items: ['NGN', 'USD', 'GBP', 'EUR'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
            onChanged: (v) => setState(() { _fromCurrency = v!; _convert(); })),
        ]),
      ]))),
      // Swap button
      Center(child: IconButton(icon: const Icon(Icons.swap_vert, size: 32), onPressed: () => setState(() {
        final tmp = _fromCurrency; _fromCurrency = _toCurrency; _toCurrency = tmp; _convert();
      }))),
      // To
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('They Receive', style: TextStyle(color: Colors.grey)),
        Row(children: [
          Expanded(child: Text(_convertedAmount?.toStringAsFixed(2) ?? '0.00', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold))),
          DropdownButton<String>(value: _toCurrency, items: ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
            onChanged: (v) => setState(() { _toCurrency = v!; _convert(); })),
        ]),
      ]))),
      const SizedBox(height: 12),
      if (_fromCurrency == 'NGN' && _rates.containsKey(_toCurrency)) Text('Rate: \u20A6${_rates[_toCurrency]!["sell"]} / 1 $_toCurrency', textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
      const SizedBox(height: 16),
      Card(color: Colors.orange.shade50, child: const Padding(padding: EdgeInsets.all(12), child: Row(children: [
        Icon(Icons.info, color: Colors.orange, size: 16), SizedBox(width: 8),
        Expanded(child: Text('CBN daily FX limit: \$5,000 (PTA) / \$4,000 (BTA)', style: TextStyle(fontSize: 12))),
      ]))),
      const SizedBox(height: 16),
      ElevatedButton(onPressed: _convertedAmount != null ? () {} : null, child: const Text('Convert Now')),
    ],
  ));

  Widget _ratesTab() => ListView(padding: const EdgeInsets.all(16), children: [
    Card(child: const Padding(padding: EdgeInsets.all(12), child: Text('Live Market Rates (Updated: 5 min ago)', style: TextStyle(fontWeight: FontWeight.bold)))),
    DataTable(columnSpacing: 16, columns: const [
      DataColumn(label: Text('Currency')), DataColumn(label: Text('Buy'), numeric: true),
      DataColumn(label: Text('Sell'), numeric: true), DataColumn(label: Text('CBN'), numeric: true),
    ], rows: _rates.entries.map((e) => DataRow(cells: [
      DataCell(Text(e.key)), DataCell(Text('\u20A6${e.value["buy"]}')),
      DataCell(Text('\u20A6${e.value["sell"]}')), DataCell(Text('\u20A6${e.value["cbn"]}')),
    ])).toList()),
  ]);

  Widget _p2pTab() => ListView(padding: const EdgeInsets.all(16), children: [
    const Text('P2P Marketplace', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
    const SizedBox(height: 8),
    _p2pOffer('Seller_001', 'USD', 1555, 5000, 98.5),
    _p2pOffer('Seller_002', 'USD', 1560, 10000, 97.2),
    _p2pOffer('Seller_003', 'GBP', 1960, 3000, 99.1),
    _p2pOffer('Seller_004', 'EUR', 1690, 2000, 96.8),
  ]);

  Widget _p2pOffer(String seller, String currency, int rate, int limit, double rating) => Card(child: ListTile(
    title: Text('$seller • $currency @ \u20A6$rate'),
    subtitle: Text('Limit: \$$limit • Rating: ${rating}%'),
    trailing: ElevatedButton(onPressed: () {}, child: const Text('Buy')),
  ));

  void _convert() {
    final amount = double.tryParse(_amountController.text) ?? 0;
    if (amount <= 0) { setState(() => _convertedAmount = null); return; }
    if (_fromCurrency == 'NGN' && _rates.containsKey(_toCurrency)) {
      setState(() => _convertedAmount = amount / _rates[_toCurrency]!['sell']!);
    } else if (_toCurrency == 'NGN' && _rates.containsKey(_fromCurrency)) {
      setState(() => _convertedAmount = amount * _rates[_fromCurrency]!['buy']!);
    } else {
      setState(() => _convertedAmount = amount);
    }
  }
}
