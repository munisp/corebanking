import 'package:flutter/material.dart';

/// Investment Portfolio — Mutual funds, treasury bills, stocks with real-time valuations
class InvestmentPortfolioScreen extends StatefulWidget {
  const InvestmentPortfolioScreen({super.key});
  @override
  State<InvestmentPortfolioScreen> createState() => _InvestmentPortfolioScreenState();
}

class _InvestmentPortfolioScreenState extends State<InvestmentPortfolioScreen> {
  final _portfolio = [
    {'name': 'FGN Savings Bond', 'type': 'bond', 'value': 5000000, 'return': 15.5, 'maturity': '2028-03-15'},
    {'name': 'NGX ETF (VETIVA)', 'type': 'etf', 'value': 2500000, 'return': 22.3, 'maturity': null},
    {'name': '91-Day T-Bill', 'type': 'tbill', 'value': 10000000, 'return': 18.0, 'maturity': '2026-09-09'},
    {'name': 'Money Market Fund', 'type': 'fund', 'value': 3000000, 'return': 12.8, 'maturity': null},
  ];

  @override
  Widget build(BuildContext context) {
    final totalValue = _portfolio.fold<int>(0, (s, p) => s + (p['value'] as int));
    final avgReturn = _portfolio.fold<double>(0, (s, p) => s + (p['return'] as double)) / _portfolio.length;

    return Scaffold(
      appBar: AppBar(title: const Text('Investments')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Portfolio summary
        Card(
          color: Colors.indigo.shade700,
          child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
            const Text('Portfolio Value', style: TextStyle(color: Colors.white70)),
            Text('\u20A6${_fmt(totalValue)}', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.trending_up, color: Colors.greenAccent, size: 16),
              Text(' +${avgReturn.toStringAsFixed(1)}% avg return', style: const TextStyle(color: Colors.greenAccent)),
            ]),
          ])),
        ),
        const SizedBox(height: 16),
        // Holdings
        const Text('Holdings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        ..._portfolio.map((p) => Card(child: ListTile(
          leading: CircleAvatar(backgroundColor: _typeColor(p['type'] as String).withOpacity(0.1),
            child: Icon(_typeIcon(p['type'] as String), color: _typeColor(p['type'] as String))),
          title: Text(p['name'] as String),
          subtitle: Text(p['maturity'] != null ? 'Matures: ${p["maturity"]}' : 'Open-ended'),
          trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('\u20A6${_fmt(p["value"] as int)}', style: const TextStyle(fontWeight: FontWeight.bold)),
            Text('+${p["return"]}%', style: const TextStyle(color: Colors.green, fontSize: 12)),
          ]),
        ))),
        const SizedBox(height: 24),
        // Quick invest
        const Text('Quick Invest', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        Row(children: [
          _investOption('T-Bills', '18%', Icons.account_balance),
          _investOption('Bonds', '15.5%', Icons.receipt_long),
          _investOption('Stocks', '22%+', Icons.show_chart),
          _investOption('Funds', '12.8%', Icons.pie_chart),
        ].map((w) => Expanded(child: Padding(padding: const EdgeInsets.all(4), child: w))).toList()),
      ]),
    );
  }

  Color _typeColor(String type) => {'bond': Colors.blue, 'etf': Colors.purple, 'tbill': Colors.green, 'fund': Colors.orange}[type] ?? Colors.grey;
  IconData _typeIcon(String type) => {'bond': Icons.receipt_long, 'etf': Icons.show_chart, 'tbill': Icons.account_balance, 'fund': Icons.pie_chart}[type] ?? Icons.attach_money;
  String _fmt(int v) => v.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');

  Widget _investOption(String label, String rate, IconData icon) => InkWell(onTap: () {},
    child: Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
      Icon(icon, color: Colors.indigo), const SizedBox(height: 4),
      Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
      Text(rate, style: const TextStyle(fontSize: 10, color: Colors.green)),
    ]))));
}
