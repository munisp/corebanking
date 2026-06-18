import 'package:flutter/material.dart';

/// Budget Tracker — Monthly budget categories, spending analysis, alerts
class BudgetTrackerScreen extends StatefulWidget {
  const BudgetTrackerScreen({super.key});
  @override
  State<BudgetTrackerScreen> createState() => _BudgetTrackerScreenState();
}

class _BudgetTrackerScreenState extends State<BudgetTrackerScreen> {
  final _budgets = [
    {'category': 'Food & Groceries', 'budget': 150000, 'spent': 98000, 'icon': Icons.restaurant, 'color': Colors.orange},
    {'category': 'Transport', 'budget': 80000, 'spent': 65000, 'icon': Icons.directions_car, 'color': Colors.blue},
    {'category': 'Utilities', 'budget': 50000, 'spent': 44500, 'icon': Icons.bolt, 'color': Colors.amber},
    {'category': 'Entertainment', 'budget': 60000, 'spent': 72000, 'icon': Icons.movie, 'color': Colors.purple},
    {'category': 'Shopping', 'budget': 100000, 'spent': 45000, 'icon': Icons.shopping_bag, 'color': Colors.pink},
    {'category': 'Health', 'budget': 40000, 'spent': 12000, 'icon': Icons.health_and_safety, 'color': Colors.red},
  ];

  @override
  Widget build(BuildContext context) {
    final totalBudget = _budgets.fold<int>(0, (s, b) => s + (b['budget'] as int));
    final totalSpent = _budgets.fold<int>(0, (s, b) => s + (b['spent'] as int));

    return Scaffold(
      appBar: AppBar(title: const Text('Budget')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Month summary
        Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
          const Text('June 2026', style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            Column(children: [Text('\u20A6${_fmt(totalBudget)}', style: const TextStyle(fontWeight: FontWeight.bold)), const Text('Budget', style: TextStyle(fontSize: 12, color: Colors.grey))]),
            Column(children: [Text('\u20A6${_fmt(totalSpent)}', style: TextStyle(fontWeight: FontWeight.bold, color: totalSpent > totalBudget ? Colors.red : Colors.green)), const Text('Spent', style: TextStyle(fontSize: 12, color: Colors.grey))]),
            Column(children: [Text('\u20A6${_fmt(totalBudget - totalSpent)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)), const Text('Remaining', style: TextStyle(fontSize: 12, color: Colors.grey))]),
          ]),
          const SizedBox(height: 12),
          LinearProgressIndicator(value: totalSpent / totalBudget, color: totalSpent > totalBudget ? Colors.red : Colors.green, backgroundColor: Colors.grey.shade200),
          Text('${(totalSpent / totalBudget * 100).toStringAsFixed(0)}% used', style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ]))),
        const SizedBox(height: 16),
        // Categories
        const Text('Categories', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        ..._budgets.map((b) {
          final pct = (b['spent'] as int) / (b['budget'] as int);
          final overBudget = pct > 1.0;
          return Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(
            children: [
              Row(children: [
                Icon(b['icon'] as IconData, color: b['color'] as Color),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(b['category'] as String, style: const TextStyle(fontWeight: FontWeight.w500)),
                  Text('\u20A6${_fmt(b["spent"] as int)} / \u20A6${_fmt(b["budget"] as int)}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ])),
                if (overBudget) Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                  child: Text('Over by \u20A6${_fmt((b["spent"] as int) - (b["budget"] as int))}', style: const TextStyle(fontSize: 10, color: Colors.red))),
              ]),
              const SizedBox(height: 8),
              LinearProgressIndicator(value: pct.clamp(0, 1), color: overBudget ? Colors.red : b['color'] as Color, backgroundColor: Colors.grey.shade200),
            ],
          )));
        }),
      ]),
    );
  }

  String _fmt(int v) => v.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
}
