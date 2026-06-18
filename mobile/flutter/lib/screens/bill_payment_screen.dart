import 'package:flutter/material.dart';

class BillPaymentScreen extends StatefulWidget {
  const BillPaymentScreen({super.key});
  @override
  State<BillPaymentScreen> createState() => _BillPaymentScreenState();
}

class _BillPaymentScreenState extends State<BillPaymentScreen> {
  String? _selectedCategory;
  String? _selectedBiller;
  final _amountController = TextEditingController();
  final _customerIdController = TextEditingController();
  bool _processing = false;

  final Map<String, List<Map<String, String>>> _billers = {
    'Electricity': [
      {'name': 'IKEDC Prepaid', 'code': 'IKEDC-PRE'},
      {'name': 'IKEDC Postpaid', 'code': 'IKEDC-POST'},
      {'name': 'EKEDC Prepaid', 'code': 'EKEDC-PRE'},
      {'name': 'AEDC Prepaid', 'code': 'AEDC-PRE'},
    ],
    'Cable TV': [
      {'name': 'DSTV', 'code': 'DSTV'},
      {'name': 'GOtv', 'code': 'GOTV'},
      {'name': 'StarTimes', 'code': 'STARTIMES'},
    ],
    'Internet': [
      {'name': 'MTN Data', 'code': 'MTN-DATA'},
      {'name': 'Airtel Data', 'code': 'AIRTEL-DATA'},
      {'name': 'Glo Data', 'code': 'GLO-DATA'},
      {'name': '9mobile Data', 'code': '9MOBILE-DATA'},
      {'name': 'Spectranet', 'code': 'SPECTRANET'},
    ],
    'Airtime': [
      {'name': 'MTN Airtime', 'code': 'MTN-AIR'},
      {'name': 'Airtel Airtime', 'code': 'AIRTEL-AIR'},
      {'name': 'Glo Airtime', 'code': 'GLO-AIR'},
      {'name': '9mobile Airtime', 'code': '9MOBILE-AIR'},
    ],
    'Water': [
      {'name': 'Lagos Water Corporation', 'code': 'LWC'},
      {'name': 'FCT Water Board', 'code': 'FCTWB'},
    ],
    'Education': [
      {'name': 'WAEC', 'code': 'WAEC'},
      {'name': 'JAMB', 'code': 'JAMB'},
      {'name': 'NECO', 'code': 'NECO'},
    ],
  };

  IconData _categoryIcon(String cat) {
    switch (cat) {
      case 'Electricity': return Icons.bolt;
      case 'Cable TV': return Icons.tv;
      case 'Internet': return Icons.wifi;
      case 'Airtime': return Icons.phone_android;
      case 'Water': return Icons.water_drop;
      case 'Education': return Icons.school;
      default: return Icons.receipt;
    }
  }

  void _processPayment() {
    if (_amountController.text.isEmpty || _customerIdController.text.isEmpty) return;
    setState(() => _processing = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() => _processing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment of ₦\${_amountController.text} to $_selectedBiller successful'),
            backgroundColor: Colors.green[700]),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pay Bills'), backgroundColor: Colors.green[700]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Select Category', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.1,
            children: _billers.keys.map((cat) => InkWell(
              onTap: () => setState(() { _selectedCategory = cat; _selectedBiller = null; }),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                decoration: BoxDecoration(
                  color: _selectedCategory == cat ? Colors.green[50] : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _selectedCategory == cat ? Colors.green : Colors.grey[300]!),
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(_categoryIcon(cat), color: Colors.green[700], size: 28),
                  const SizedBox(height: 4),
                  Text(cat, style: const TextStyle(fontSize: 12), textAlign: TextAlign.center),
                ]),
              ),
            )).toList(),
          ),
          if (_selectedCategory != null) ...[
            const SizedBox(height: 20),
            Text('Select Biller', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...(_billers[_selectedCategory] ?? []).map((b) => RadioListTile<String>(
              title: Text(b['name']!),
              value: b['name']!,
              groupValue: _selectedBiller,
              onChanged: (v) => setState(() => _selectedBiller = v),
              activeColor: Colors.green[700],
            )),
          ],
          if (_selectedBiller != null) ...[
            const SizedBox(height: 16),
            TextField(controller: _customerIdController,
              decoration: InputDecoration(labelText: 'Customer ID / Meter Number',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)))),
            const SizedBox(height: 12),
            TextField(controller: _amountController, keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: 'Amount (₦)', prefixText: '₦ ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)))),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 52, child: ElevatedButton(
              onPressed: _processing ? null : _processPayment,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green[700],
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: _processing
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('Pay Now', style: TextStyle(fontSize: 16, color: Colors.white)),
            )),
          ],
        ]),
      ),
    );
  }
}
