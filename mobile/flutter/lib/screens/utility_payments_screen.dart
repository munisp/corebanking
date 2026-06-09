import 'package:flutter/material.dart';

/// Utility Payments — Electricity (PHCN/DisCos), Water, Cable TV, Internet
class UtilityPaymentsScreen extends StatefulWidget {
  const UtilityPaymentsScreen({super.key});
  @override
  State<UtilityPaymentsScreen> createState() => _UtilityPaymentsScreenState();
}

class _UtilityPaymentsScreenState extends State<UtilityPaymentsScreen> {
  String _selectedCategory = '';
  String _selectedBiller = '';
  final _meterController = TextEditingController();
  final _amountController = TextEditingController();
  bool _isValidating = false;
  bool _isProcessing = false;
  String? _customerName;
  String? _meterType; // prepaid/postpaid

  final _categories = [
    {'id': 'electricity', 'name': 'Electricity', 'icon': Icons.bolt, 'color': Colors.amber},
    {'id': 'cable', 'name': 'Cable TV', 'icon': Icons.tv, 'color': Colors.blue},
    {'id': 'internet', 'name': 'Internet', 'icon': Icons.wifi, 'color': Colors.purple},
    {'id': 'water', 'name': 'Water', 'icon': Icons.water_drop, 'color': Colors.cyan},
  ];

  final _billers = {
    'electricity': [
      {'id': 'ekedc', 'name': 'Eko Electricity (EKEDC)', 'region': 'Lagos'},
      {'id': 'ikedc', 'name': 'Ikeja Electric (IKEDC)', 'region': 'Lagos'},
      {'id': 'aedc', 'name': 'Abuja Electric (AEDC)', 'region': 'Abuja'},
      {'id': 'phed', 'name': 'Port Harcourt Electric (PHED)', 'region': 'Rivers'},
      {'id': 'kedco', 'name': 'Kano Electric (KEDCO)', 'region': 'Kano'},
      {'id': 'ibedc', 'name': 'Ibadan Electric (IBEDC)', 'region': 'Oyo'},
    ],
    'cable': [
      {'id': 'dstv', 'name': 'DSTV', 'region': 'Multichoice'},
      {'id': 'gotv', 'name': 'GOtv', 'region': 'Multichoice'},
      {'id': 'startimes', 'name': 'StarTimes', 'region': 'StarTimes'},
    ],
    'internet': [
      {'id': 'spectranet', 'name': 'Spectranet', 'region': 'Lagos/Abuja'},
      {'id': 'smile', 'name': 'Smile Communications', 'region': 'Nationwide'},
      {'id': 'swift', 'name': 'Swift Networks', 'region': 'Lagos'},
    ],
    'water': [
      {'id': 'lswc', 'name': 'Lagos Water Corp', 'region': 'Lagos'},
      {'id': 'fctwb', 'name': 'FCT Water Board', 'region': 'Abuja'},
    ],
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pay Bills')),
      body: _selectedCategory.isEmpty ? _buildCategoryGrid()
          : _selectedBiller.isEmpty ? _buildBillerList()
          : _buildPaymentForm(),
    );
  }

  Widget _buildCategoryGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(24),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 16, crossAxisSpacing: 16),
      itemCount: _categories.length,
      itemBuilder: (ctx, i) {
        final cat = _categories[i];
        return InkWell(
          onTap: () => setState(() => _selectedCategory = cat['id'] as String),
          child: Card(
            elevation: 2,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(cat['icon'] as IconData, size: 48, color: cat['color'] as Color),
              const SizedBox(height: 12),
              Text(cat['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ]),
          ),
        );
      },
    );
  }

  Widget _buildBillerList() {
    final billers = _billers[_selectedCategory] ?? [];
    return Column(
      children: [
        AppBar(title: Text(_categories.firstWhere((c) => c['id'] == _selectedCategory)['name'] as String),
            leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _selectedCategory = ''))),
        Expanded(child: ListView.builder(
          itemCount: billers.length,
          itemBuilder: (ctx, i) => ListTile(
            leading: const CircleAvatar(child: Icon(Icons.business)),
            title: Text(billers[i]['name'] as String),
            subtitle: Text(billers[i]['region'] as String),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => setState(() => _selectedBiller = billers[i]['id'] as String),
          ),
        )),
      ],
    );
  }

  Widget _buildPaymentForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Back navigation
          Row(children: [
            IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() { _selectedBiller = ''; _customerName = null; })),
            Text(_selectedBiller.toUpperCase(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 24),
          // Meter/Account number
          TextField(
            controller: _meterController,
            decoration: InputDecoration(
              labelText: _selectedCategory == 'electricity' ? 'Meter Number' : 'Smart Card / Account Number',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              suffixIcon: _isValidating ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
                  : IconButton(icon: const Icon(Icons.search), onPressed: _validateMeter),
            ),
            keyboardType: TextInputType.number,
          ),
          // Customer verification result
          if (_customerName != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                const Icon(Icons.verified, color: Colors.green),
                const SizedBox(width: 8),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_customerName!, style: const TextStyle(fontWeight: FontWeight.bold)),
                  if (_meterType != null) Text('Type: $_meterType', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ]),
              ]),
            ),
          ],
          const SizedBox(height: 16),
          // Amount
          TextField(
            controller: _amountController,
            decoration: InputDecoration(
              labelText: 'Amount (₦)',
              prefixText: '₦ ',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              helperText: 'Min: ₦500 | Max: ₦500,000',
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 8),
          // Quick amounts
          Wrap(spacing: 8, runSpacing: 8, children: [1000, 2000, 5000, 10000, 20000, 50000].map((a) =>
            ActionChip(label: Text('₦${a.toString().replaceAllMapped(RegExp(r"(\d{1,3})(?=(\d{3})+(?!\d))"), (m) => "${m[1]},")}'),
                onPressed: () => setState(() => _amountController.text = a.toString()))).toList()),
          const SizedBox(height: 24),
          // Pay button
          ElevatedButton(
            onPressed: (_customerName != null && _amountController.text.isNotEmpty && !_isProcessing) ? _processPayment : null,
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16), backgroundColor: Colors.green),
            child: _isProcessing ? const CircularProgressIndicator(color: Colors.white) : const Text('Pay Now', style: TextStyle(fontSize: 16, color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _validateMeter() {
    if (_meterController.text.length < 8) return;
    setState(() => _isValidating = true);
    Future.delayed(const Duration(seconds: 1), () {
      setState(() { _isValidating = false; _customerName = 'ADEBAYO OGUNLESI'; _meterType = 'Prepaid'; });
    });
  }

  void _processPayment() {
    setState(() => _isProcessing = true);
    Future.delayed(const Duration(seconds: 2), () {
      setState(() => _isProcessing = false);
      showDialog(context: context, builder: (ctx) => AlertDialog(
        title: const Row(children: [Icon(Icons.check_circle, color: Colors.green), SizedBox(width: 8), Text('Payment Successful')]),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Amount: ₦${_amountController.text}'),
          Text('Token: ${DateTime.now().millisecondsSinceEpoch.toString().substring(0, 16)}'),
          const Text('Ref: BILL-54B-20260609-001'),
        ]),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done'))],
      ));
    });
  }
}
