import 'package:flutter/material.dart';

class CustomerEngagementScreen extends StatefulWidget {
  const CustomerEngagementScreen({super.key});
  @override
  State<CustomerEngagementScreen> createState() => _CustomerEngagementScreenState();
}

class _CustomerEngagementScreenState extends State<CustomerEngagementScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  
  final List<Map<String, dynamic>> _campaigns = [
    {'name': 'Salary Account Promo', 'channel': 'Push + SMS', 'sent': 45000, 'opened': 12400, 'converted': 3200, 'status': 'Active'},
    {'name': 'FD Rate Increase', 'channel': 'Email', 'sent': 23000, 'opened': 8900, 'converted': 1450, 'status': 'Active'},
    {'name': 'Dormant Re-activation', 'channel': 'SMS + Call', 'sent': 78000, 'opened': 15600, 'converted': 4100, 'status': 'Completed'},
    {'name': 'SME Loan Offer', 'channel': 'Push', 'sent': 12000, 'opened': 5600, 'converted': 890, 'status': 'Draft'},
  ];

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Engagement'),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(text: 'Campaigns'), Tab(text: 'Analytics'), Tab(text: 'Templates'),
        ])),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add), tooltip: 'New Campaign'),
      body: TabBarView(controller: _tabController, children: [
        ListView.builder(itemCount: _campaigns.length, itemBuilder: (ctx, i) {
          final c = _campaigns[i];
          final openRate = ((c['opened'] as int) / (c['sent'] as int) * 100).toStringAsFixed(1);
          final convRate = ((c['converted'] as int) / (c['sent'] as int) * 100).toStringAsFixed(1);
          return Card(margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: ExpansionTile(
            leading: Icon(c['status'] == 'Active' ? Icons.play_circle : c['status'] == 'Completed' ? Icons.check_circle : Icons.edit,
              color: c['status'] == 'Active' ? Colors.green : c['status'] == 'Completed' ? Colors.blue : Colors.grey),
            title: Text(c['name'] as String), subtitle: Text('${c["channel"]} | $openRate% open rate'),
            children: [
              Padding(padding: const EdgeInsets.all(16), child: Row(children: [
                _metricCard('Sent', '${c["sent"]}', Colors.blue),
                _metricCard('Opened', '${c["opened"]}', Colors.orange),
                _metricCard('Converted', '${c["converted"]}', Colors.green),
                _metricCard('Conv. Rate', '$convRate%', Colors.purple),
              ])),
            ],
          ));
        }),
        const Center(child: Text('Campaign Analytics Dashboard')),
        const Center(child: Text('Message Templates Library')),
      ]),
    );
  }

  Widget _metricCard(String label, String value, Color color) {
    return Expanded(child: Column(children: [
      Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ]));
  }
}
