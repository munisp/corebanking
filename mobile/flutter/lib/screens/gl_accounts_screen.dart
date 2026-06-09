import 'package:flutter/material.dart';

class GlAccountsScreen extends StatefulWidget {
  const GlAccountsScreen({super.key});
  @override
  State<GlAccountsScreen> createState() => _GlAccountsScreenState();
}

class _GlAccountsScreenState extends State<GlAccountsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _searchController = TextEditingController();

  final List<Map<String, String>> _entries = [
    {'date': '2024-01-15', 'ref': 'JV-2024-0045', 'debit': '1000 - Cash', 'credit': '4000 - Interest Income', 'amount': '₦12,500,000', 'narration': 'Monthly interest accrual'},
    {'date': '2024-01-15', 'ref': 'JV-2024-0046', 'debit': '5100 - Staff Costs', 'credit': '2100 - Accrued Expenses', 'amount': '₦45,000,000', 'narration': 'January salary provision'},
    {'date': '2024-01-14', 'ref': 'AUTO-EOD-0114', 'debit': '1200 - Loans', 'credit': '4000 - Interest Income', 'amount': '₦8,900,000', 'narration': 'Loan interest accrual - EOD'},
    {'date': '2024-01-14', 'ref': 'AUTO-EOD-0114', 'debit': '5000 - Interest Expense', 'credit': '2000 - Deposits', 'amount': '₦3,200,000', 'narration': 'Deposit interest accrual - EOD'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('General Ledger'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'Journal Entries'), Tab(text: 'Trial Balance'), Tab(text: 'Reconciliation'),
        ])),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add), tooltip: 'New Journal Entry'),
      body: TabBarView(controller: _tabController, children: [
        Column(children: [
          Padding(padding: const EdgeInsets.all(8), child: TextField(controller: _searchController,
            decoration: const InputDecoration(hintText: 'Search by reference or narration...', prefixIcon: Icon(Icons.search), border: OutlineInputBorder()))),
          Expanded(child: ListView.builder(itemCount: _entries.length, itemBuilder: (ctx, i) {
            final e = _entries[i];
            return Card(margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), child: ExpansionTile(
              leading: const Icon(Icons.receipt_long, color: Colors.indigo),
              title: Text(e['ref']!), subtitle: Text('${e["date"]} | ${e["amount"]}'),
              children: [
                ListTile(dense: true, title: Text('DR: ${e["debit"]}'), leading: const Icon(Icons.arrow_upward, color: Colors.red, size: 16)),
                ListTile(dense: true, title: Text('CR: ${e["credit"]}'), leading: const Icon(Icons.arrow_downward, color: Colors.green, size: 16)),
                ListTile(dense: true, title: Text('Narration: ${e["narration"]}')),
              ],
            ));
          })),
        ]),
        const Center(child: Text('Trial Balance Report')),
        const Center(child: Text('GL Reconciliation')),
      ]),
    );
  }
}
