import 'package:flutter/material.dart';

class Customer360Screen extends StatefulWidget {
  const Customer360Screen({super.key});
  @override
  State<Customer360Screen> createState() => _Customer360ScreenState();
}

class _Customer360ScreenState extends State<Customer360Screen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final String _customerId = 'CUS-00234567';
  final String _customerName = 'Adebayo Ogunlade';
  final String _bvn = '22100456789';
  final String _tier = 'Tier 3';
  final double _totalDeposits = 15670000.00;
  final double _totalLoans = 4500000.00;
  final int _productCount = 7;
  final String _riskRating = 'Low';
  final String _relationshipManager = 'Chioma Nwosu';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer 360°'), backgroundColor: Colors.indigo,
        bottom: TabBar(controller: _tabController, isScrollable: true, tabs: const [
          Tab(text: 'Overview'), Tab(text: 'Accounts'), Tab(text: 'Transactions'), Tab(text: 'Products'), Tab(text: 'Interactions'),
        ])),
      body: Column(children: [
        Container(padding: const EdgeInsets.all(16), color: Colors.indigo[50], child: Row(children: [
          const CircleAvatar(radius: 30, child: Icon(Icons.person, size: 36)),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_customerName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text('ID: $_customerId | BVN: $_bvn'),
            Text('Tier: $_tier | Risk: $_riskRating | RM: $_relationshipManager'),
          ])),
        ])),
        Expanded(child: TabBarView(controller: _tabController, children: [
          _buildOverviewTab(),
          _buildAccountsTab(),
          _buildTransactionsTab(),
          _buildProductsTab(),
          _buildInteractionsTab(),
        ])),
      ]),
    );
  }

  Widget _buildOverviewTab() {
    return SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
      Row(children: [
        Expanded(child: _kpiCard('Total Deposits', '₦${(_totalDeposits / 1000000).toStringAsFixed(1)}M', Icons.savings, Colors.green)),
        Expanded(child: _kpiCard('Total Loans', '₦${(_totalLoans / 1000000).toStringAsFixed(1)}M', Icons.account_balance, Colors.orange)),
      ]),
      Row(children: [
        Expanded(child: _kpiCard('Products', '$_productCount', Icons.inventory, Colors.blue)),
        Expanded(child: _kpiCard('Risk Rating', _riskRating, Icons.shield, Colors.teal)),
      ]),
      const SizedBox(height: 16),
      const Card(child: ListTile(leading: Icon(Icons.trending_up, color: Colors.green), title: Text('Customer Since'), subtitle: Text('March 2019 (6+ years)'))),
      const Card(child: ListTile(leading: Icon(Icons.star, color: Colors.amber), title: Text('Loyalty Tier'), subtitle: Text('Gold Member - 15,234 points'))),
    ]));
  }

  Widget _buildAccountsTab() {
    final accounts = [
      {'number': '0012345678', 'type': 'Savings', 'balance': '₦8,450,000', 'status': 'Active'},
      {'number': '0012345679', 'type': 'Current', 'balance': '₦5,220,000', 'status': 'Active'},
      {'number': '0012345680', 'type': 'Domiciliary (USD)', 'balance': '\$12,500', 'status': 'Active'},
      {'number': '0012345681', 'type': 'Fixed Deposit', 'balance': '₦2,000,000', 'status': 'Matured'},
    ];
    return ListView.builder(itemCount: accounts.length, itemBuilder: (ctx, i) {
      final a = accounts[i];
      return Card(margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: ListTile(
        leading: CircleAvatar(child: Text(a['type']![0])),
        title: Text('${a["type"]} - ${a["number"]}'),
        subtitle: Text('Balance: ${a["balance"]}'),
        trailing: Chip(label: Text(a['status']!), backgroundColor: a['status'] == 'Active' ? Colors.green[100] : Colors.orange[100]),
      ));
    });
  }

  Widget _buildTransactionsTab() {
    final txns = [
      {'date': '2024-01-15', 'desc': 'Transfer to Chidinma Okafor', 'amount': '-₦250,000', 'type': 'Debit'},
      {'date': '2024-01-14', 'desc': 'Salary Credit - ABC Corp', 'amount': '+₦1,500,000', 'type': 'Credit'},
      {'date': '2024-01-13', 'desc': 'POS Purchase - Shoprite Ikeja', 'amount': '-₦45,600', 'type': 'Debit'},
      {'date': '2024-01-12', 'desc': 'Airtime Purchase - MTN', 'amount': '-₦5,000', 'type': 'Debit'},
      {'date': '2024-01-11', 'desc': 'Transfer from Emeka Nwankwo', 'amount': '+₦100,000', 'type': 'Credit'},
    ];
    return ListView.builder(itemCount: txns.length, itemBuilder: (ctx, i) {
      final t = txns[i];
      return ListTile(
        leading: Icon(t['type'] == 'Credit' ? Icons.arrow_downward : Icons.arrow_upward,
          color: t['type'] == 'Credit' ? Colors.green : Colors.red),
        title: Text(t['desc']!),
        subtitle: Text(t['date']!),
        trailing: Text(t['amount']!, style: TextStyle(color: t['type'] == 'Credit' ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
      );
    });
  }

  Widget _buildProductsTab() {
    final products = [
      {'name': 'Savings Account', 'status': 'Active', 'since': '2019'},
      {'name': 'Current Account', 'status': 'Active', 'since': '2019'},
      {'name': 'Debit Card (Verve)', 'status': 'Active', 'since': '2020'},
      {'name': 'Mobile Banking', 'status': 'Active', 'since': '2019'},
      {'name': 'Internet Banking', 'status': 'Active', 'since': '2020'},
      {'name': 'Fixed Deposit', 'status': 'Matured', 'since': '2023'},
      {'name': 'Personal Loan', 'status': 'Closed', 'since': '2022'},
    ];
    return ListView.builder(itemCount: products.length, itemBuilder: (ctx, i) {
      final p = products[i];
      return ListTile(leading: const Icon(Icons.inventory_2), title: Text(p['name']!),
        subtitle: Text('Since ${p["since"]}'), trailing: Chip(label: Text(p['status']!)));
    });
  }

  Widget _buildInteractionsTab() {
    final interactions = [
      {'date': '2024-01-10', 'channel': 'Branch', 'type': 'FD Enquiry', 'agent': 'Tunde Bello'},
      {'date': '2024-01-05', 'channel': 'Call Center', 'type': 'Card Block Request', 'agent': 'System'},
      {'date': '2023-12-20', 'channel': 'Email', 'type': 'Statement Request', 'agent': 'Auto'},
      {'date': '2023-12-15', 'channel': 'Branch', 'type': 'Address Update', 'agent': 'Aisha Balogun'},
    ];
    return ListView.builder(itemCount: interactions.length, itemBuilder: (ctx, i) {
      final x = interactions[i];
      return ListTile(leading: Icon(_channelIcon(x['channel']!)), title: Text(x['type']!),
        subtitle: Text('${x["date"]} via ${x["channel"]}'), trailing: Text(x['agent']!));
    });
  }

  IconData _channelIcon(String channel) {
    switch (channel) {
      case 'Branch': return Icons.store;
      case 'Call Center': return Icons.phone;
      case 'Email': return Icons.email;
      default: return Icons.chat;
    }
  }

  Widget _kpiCard(String title, String value, IconData icon, Color color) {
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
      Icon(icon, color: color, size: 32), const SizedBox(height: 8),
      Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
      Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
    ])));
  }
}
