import 'package:flutter/material.dart';

/// Airtime & Data Purchase — Buy airtime/data for self or others, all Nigerian networks
class AirtimeDataScreen extends StatefulWidget {
  const AirtimeDataScreen({super.key});
  @override
  State<AirtimeDataScreen> createState() => _AirtimeDataScreenState();
}

class _AirtimeDataScreenState extends State<AirtimeDataScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedNetwork = 'mtn';
  final _phoneController = TextEditingController();
  final _amountController = TextEditingController();
  bool _isProcessing = false;
  String _selectedData = '';

  final _networks = [
    {'id': 'mtn', 'name': 'MTN', 'color': Colors.amber},
    {'id': 'airtel', 'name': 'Airtel', 'color': Colors.red},
    {'id': 'glo', 'name': 'Glo', 'color': Colors.green},
    {'id': '9mobile', 'name': '9mobile', 'color': Colors.teal},
  ];

  final _dataPlans = {
    'mtn': [
      {'name': '1GB - 30 days', 'price': 500, 'id': 'mtn_1gb'},
      {'name': '2GB - 30 days', 'price': 1000, 'id': 'mtn_2gb'},
      {'name': '5GB - 30 days', 'price': 2000, 'id': 'mtn_5gb'},
      {'name': '10GB - 30 days', 'price': 3500, 'id': 'mtn_10gb'},
      {'name': '25GB - 30 days', 'price': 6000, 'id': 'mtn_25gb'},
      {'name': '75GB - 30 days', 'price': 15000, 'id': 'mtn_75gb'},
    ],
    'airtel': [
      {'name': '1.5GB - 30 days', 'price': 500, 'id': 'air_1.5gb'},
      {'name': '3GB - 30 days', 'price': 1000, 'id': 'air_3gb'},
      {'name': '6GB - 30 days', 'price': 2000, 'id': 'air_6gb'},
      {'name': '10GB - 30 days', 'price': 3000, 'id': 'air_10gb'},
    ],
    'glo': [
      {'name': '2GB - 30 days', 'price': 500, 'id': 'glo_2gb'},
      {'name': '4.5GB - 30 days', 'price': 1000, 'id': 'glo_4.5gb'},
      {'name': '7.5GB - 30 days', 'price': 2000, 'id': 'glo_7.5gb'},
    ],
    '9mobile': [
      {'name': '1.5GB - 30 days', 'price': 500, 'id': '9m_1.5gb'},
      {'name': '4.5GB - 30 days', 'price': 1500, 'id': '9m_4.5gb'},
      {'name': '11GB - 30 days', 'price': 3000, 'id': '9m_11gb'},
    ],
  };

  @override
  void initState() { super.initState(); _tabController = TabController(length: 2, vsync: this); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Airtime & Data'), bottom: TabBar(controller: _tabController, tabs: const [
        Tab(text: 'Airtime'), Tab(text: 'Data'),
      ])),
      body: Column(children: [
        // Network selector
        Padding(padding: const EdgeInsets.all(16), child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: _networks.map((n) => InkWell(
            onTap: () => setState(() => _selectedNetwork = n['id'] as String),
            child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: _selectedNetwork == n['id'] ? (n['color'] as Color).withOpacity(0.1) : null,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _selectedNetwork == n['id'] ? n['color'] as Color : Colors.grey.shade300),
              ),
              child: Text(n['name'] as String, style: TextStyle(fontWeight: _selectedNetwork == n['id'] ? FontWeight.bold : FontWeight.normal, color: n['color'] as Color)),
            ),
          )).toList(),
        )),
        // Phone
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: TextField(
          controller: _phoneController, keyboardType: TextInputType.phone,
          decoration: InputDecoration(labelText: 'Phone Number', prefixText: '+234 ', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            suffixIcon: IconButton(icon: const Icon(Icons.contacts), onPressed: () {})),
        )),
        const SizedBox(height: 12),
        // Tab content
        Expanded(child: TabBarView(controller: _tabController, children: [_airtimeTab(), _dataTab()])),
      ]),
    );
  }

  Widget _airtimeTab() => Padding(padding: const EdgeInsets.all(16), child: Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextField(controller: _amountController, keyboardType: TextInputType.number,
        decoration: InputDecoration(labelText: 'Amount (₦)', prefixText: '₦ ', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          helperText: 'Min: ₦50 | Max: ₦50,000')),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [100, 200, 500, 1000, 2000, 5000].map((a) =>
        ActionChip(label: Text('₦$a'), onPressed: () => setState(() => _amountController.text = a.toString()))).toList()),
      const Spacer(),
      ElevatedButton(onPressed: _isProcessing ? null : _buyAirtime, style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
        child: _isProcessing ? const CircularProgressIndicator() : const Text('Buy Airtime')),
    ],
  ));

  Widget _dataTab() => ListView(padding: const EdgeInsets.all(16), children: [
    ...(_dataPlans[_selectedNetwork] ?? []).map((plan) => Card(
      color: _selectedData == plan['id'] ? Colors.green.shade50 : null,
      child: ListTile(
        title: Text(plan['name'] as String),
        trailing: Text('₦${plan["price"]}', style: const TextStyle(fontWeight: FontWeight.bold)),
        selected: _selectedData == plan['id'],
        onTap: () => setState(() => _selectedData = plan['id'] as String),
      ),
    )),
    const SizedBox(height: 16),
    ElevatedButton(onPressed: (_selectedData.isNotEmpty && !_isProcessing) ? _buyData : null,
      style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
      child: _isProcessing ? const CircularProgressIndicator() : const Text('Buy Data')),
  ]);

  void _buyAirtime() {
    setState(() => _isProcessing = true);
    Future.delayed(const Duration(seconds: 2), () {
      setState(() => _isProcessing = false);
      _showSuccess('Airtime', _amountController.text);
    });
  }

  void _buyData() {
    setState(() => _isProcessing = true);
    Future.delayed(const Duration(seconds: 2), () {
      setState(() => _isProcessing = false);
      final plan = (_dataPlans[_selectedNetwork] ?? []).firstWhere((p) => p['id'] == _selectedData, orElse: () => {});
      _showSuccess('Data', plan['price']?.toString() ?? '0');
    });
  }

  void _showSuccess(String type, String amount) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Row(children: [Icon(Icons.check_circle, color: Colors.green), SizedBox(width: 8), Text('Success!')]),
      content: Text('$type purchase of ₦$amount successful.\nRef: VAS-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done'))],
    ));
  }
}
