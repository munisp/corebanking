import 'package:flutter/material.dart';

class IslamicBankingScreen extends StatefulWidget {
  const IslamicBankingScreen({super.key});
  @override
  State<IslamicBankingScreen> createState() => _IslamicBankingScreenState();
}

class _IslamicBankingScreenState extends State<IslamicBankingScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  String _searchQuery = '';

  final List<Map<String, dynamic>> _products = [
    {'name': 'Murabaha Financing', 'type': 'Trade Finance', 'rate': '15% markup', 'portfolio': '₦12.5B', 'clients': 2450, 'status': 'Active'},
    {'name': 'Ijara (Leasing)', 'type': 'Asset Finance', 'rate': '12% rental', 'portfolio': '₦8.2B', 'clients': 1200, 'status': 'Active'},
    {'name': 'Musharaka Partnership', 'type': 'Equity Finance', 'rate': 'Profit sharing', 'portfolio': '₦5.8B', 'clients': 450, 'status': 'Active'},
    {'name': 'Sukuk Issuance', 'type': 'Capital Market', 'rate': '14% yield', 'portfolio': '₦25B', 'clients': 180, 'status': 'Active'},
    {'name': 'Takaful Insurance', 'type': 'Risk Sharing', 'rate': 'Contribution based', 'portfolio': '₦3.2B', 'clients': 8500, 'status': 'Active'},
    {'name': 'Wakala Investment', 'type': 'Agency', 'rate': '10% fee', 'portfolio': '₦6.5B', 'clients': 3200, 'status': 'Active'},
    {'name': 'Salam (Forward Sale)', 'type': 'Agriculture', 'rate': 'Spot + margin', 'portfolio': '₦2.1B', 'clients': 890, 'status': 'Active'},
    {'name': 'Istisna (Manufacturing)', 'type': 'Project Finance', 'rate': 'Cost + margin', 'portfolio': '₦4.5B', 'clients': 120, 'status': 'Active'},
  ];

  final List<Map<String, dynamic>> _shariahBoard = [
    {'name': 'Dr. Ahmad Bello', 'role': 'Chairman', 'specialization': 'Fiqh al-Muamalat', 'rulings': 45},
    {'name': 'Sheikh Usman Ibrahim', 'role': 'Member', 'specialization': 'Islamic Commercial Law', 'rulings': 38},
    {'name': 'Dr. Fatima Yusuf', 'role': 'Member', 'specialization': 'Islamic Finance', 'rulings': 32},
  ];

  List<Map<String, dynamic>> get _filteredProducts => _searchQuery.isEmpty
      ? _products
      : _products.where((p) => p.values.any((v) => v.toString().toLowerCase().contains(_searchQuery.toLowerCase()))).toList();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Widget _kpi(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Colors.green[700], size: 20),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Islamic Banking'),
        backgroundColor: Colors.green[700],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Products'),
            Tab(text: 'Shariah Board'),
            Tab(text: 'Compliance'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildProductsTab(),
          _buildShariahTab(),
          _buildComplianceTab(),
        ],
      ),
    );
  }

  Widget _buildProductsTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.6,
            children: [
              _kpi('Total Portfolio', '₦67.8B', Icons.account_balance),
              _kpi('Active Products', '8', Icons.inventory),
              _kpi('Clients', '16,990', Icons.people),
              _kpi('Shariah Compliant', '100%', Icons.verified),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: InputDecoration(
              hintText: 'Search products (Murabaha, Sukuk, Takaful...)',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.builder(
              itemCount: _filteredProducts.length,
              itemBuilder: (context, index) {
                final p = _filteredProducts[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.green[100],
                      child: Text(p['name'].toString().substring(0, 1)),
                    ),
                    title: Text(p['name'].toString()),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${p['type']} — ${p['rate']}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                        Text('Portfolio: ${p['portfolio']} | Clients: ${p['clients']}', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                      ],
                    ),
                    trailing: Chip(
                      label: Text(p['status'].toString(), style: const TextStyle(fontSize: 12)),
                      backgroundColor: Colors.green[100],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShariahTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Shariah Advisory Board', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ..._shariahBoard.map((m) => Card(
          child: ListTile(
            leading: CircleAvatar(backgroundColor: Colors.green[100], child: const Icon(Icons.person, color: Colors.green)),
            title: Text(m['name'].toString()),
            subtitle: Text('${m['role']} — ${m['specialization']}'),
            trailing: Text('${m['rulings']} rulings', style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
        )),
        const SizedBox(height: 16),
        const Text('Recent Fatawa', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Card(child: ListTile(
          leading: Icon(Icons.gavel, color: Colors.green),
          title: const Text('Murabaha with Deferred Payment'),
          subtitle: const Text('Approved — 60-month tenor for vehicle financing'),
          trailing: const Text('2024-01-15'),
        )),
        Card(child: ListTile(
          leading: Icon(Icons.gavel, color: Colors.green),
          title: const Text('Sukuk al-Ijara Structure'),
          subtitle: const Text('Approved — asset-backed with quarterly distributions'),
          trailing: const Text('2024-01-10'),
        )),
      ],
    );
  }

  Widget _buildComplianceTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('AAOIFI Compliance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Card(child: ListTile(
          leading: Icon(Icons.check_circle, color: Colors.green),
          title: const Text('FAS 28: Murabaha'),
          subtitle: const Text('Full compliance with AAOIFI standard'),
          trailing: const Text('Pass', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
        )),
        Card(child: ListTile(
          leading: Icon(Icons.check_circle, color: Colors.green),
          title: const Text('FAS 8: Ijara'),
          subtitle: const Text('Lease-to-own structure validated'),
          trailing: const Text('Pass', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
        )),
        Card(child: ListTile(
          leading: Icon(Icons.check_circle, color: Colors.green),
          title: const Text('FAS 17: Sukuk'),
          subtitle: const Text('Asset-backed structure certified'),
          trailing: const Text('Pass', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
        )),
        Card(child: ListTile(
          leading: Icon(Icons.check_circle, color: Colors.green),
          title: const Text('FAS 26: Takaful'),
          subtitle: const Text('Participant fund segregation verified'),
          trailing: const Text('Pass', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
        )),
        const SizedBox(height: 16),
        const Text('Shariah Screening Ratios', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Card(child: ListTile(
          leading: Icon(Icons.percent, color: Colors.green),
          title: const Text('Debt/Total Assets'),
          subtitle: const Text('Must be < 33% (AAOIFI threshold)'),
          trailing: const Text('28.5%', style: TextStyle(fontWeight: FontWeight.bold)),
        )),
        Card(child: ListTile(
          leading: Icon(Icons.percent, color: Colors.green),
          title: const Text('Non-Permissible Income'),
          subtitle: const Text('Must be < 5% of revenue'),
          trailing: const Text('1.2%', style: TextStyle(fontWeight: FontWeight.bold)),
        )),
      ],
    );
  }
}
