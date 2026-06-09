import 'package:flutter/material.dart';

/// Agricultural USSD Banking — Specialized banking for farmers with crop cycle loans
class InteractiveUssdAgriScreen extends StatefulWidget {
  const InteractiveUssdAgriScreen({super.key});
  @override
  State<InteractiveUssdAgriScreen> createState() => _InteractiveUssdAgriScreenState();
}

class _InteractiveUssdAgriScreenState extends State<InteractiveUssdAgriScreen> {
  String _selectedCrop = '';
  final _hectaresController = TextEditingController();
  final _locationController = TextEditingController();
  bool _isCalculating = false;
  Map<String, dynamic>? _loanEstimate;

  final _crops = [
    {'name': 'Rice', 'season': 'Apr-Oct', 'costPerHa': 450000, 'yieldPerHa': 4500, 'pricePerKg': 650},
    {'name': 'Maize', 'season': 'Mar-Aug', 'costPerHa': 250000, 'yieldPerHa': 3000, 'pricePerKg': 350},
    {'name': 'Cassava', 'season': 'Apr-Dec', 'costPerHa': 350000, 'yieldPerHa': 25000, 'pricePerKg': 120},
    {'name': 'Yam', 'season': 'Feb-Nov', 'costPerHa': 800000, 'yieldPerHa': 15000, 'pricePerKg': 400},
    {'name': 'Cocoa', 'season': 'Year-round', 'costPerHa': 600000, 'yieldPerHa': 800, 'pricePerKg': 3500},
    {'name': 'Groundnut', 'season': 'May-Oct', 'costPerHa': 200000, 'yieldPerHa': 1500, 'pricePerKg': 800},
  ];

  final _states = ['Benue', 'Kano', 'Kaduna', 'Niger', 'Ogun', 'Oyo', 'Kwara', 'Nasarawa', 'Kebbi', 'Sokoto'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AgriBank USSD'), backgroundColor: Colors.green.shade700),
      body: SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Card(color: Colors.green.shade50, child: const Padding(padding: EdgeInsets.all(16), child: Column(children: [
            Icon(Icons.agriculture, size: 48, color: Colors.green),
            SizedBox(height: 8),
            Text('Crop Cycle Loan Calculator', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text('CBN Anchor Borrowers Programme', style: TextStyle(color: Colors.grey)),
          ]))),
          const SizedBox(height: 20),
          // Crop selection
          const Text('Select Crop', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: _crops.map((c) => ChoiceChip(
            label: Text('${c["name"]} (${c["season"]})'),
            selected: _selectedCrop == c['name'],
            onSelected: (_) => setState(() => _selectedCrop = c['name'] as String),
            selectedColor: Colors.green.shade100,
          )).toList()),
          const SizedBox(height: 16),
          // Hectares
          TextField(
            controller: _hectaresController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Farm Size (Hectares)',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              helperText: 'Max: 5ha for smallholder, 50ha for commercial',
            ),
          ),
          const SizedBox(height: 16),
          // Location
          DropdownButtonFormField<String>(
            decoration: InputDecoration(labelText: 'State', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
            items: _states.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => _locationController.text = v ?? ''),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            icon: _isCalculating ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.calculate),
            label: Text(_isCalculating ? 'Calculating...' : 'Calculate Loan'),
            onPressed: (_selectedCrop.isNotEmpty && _hectaresController.text.isNotEmpty) ? _calculate : null,
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green.shade700, foregroundColor: Colors.white, padding: const EdgeInsets.all(16)),
          ),
          // Results
          if (_loanEstimate != null) ...[
            const SizedBox(height: 24),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Loan Estimate', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const Divider(),
                _row('Loan Amount', '₦${_fmt(_loanEstimate!["amount"])}'),
                _row('Interest Rate', '${_loanEstimate!["rate"]}% (CBN ABP)'),
                _row('Tenure', '${_loanEstimate!["tenure"]} months'),
                _row('Expected Yield', '${_loanEstimate!["yield"]} kg'),
                _row('Expected Revenue', '₦${_fmt(_loanEstimate!["revenue"])}'),
                _row('Repayment', '₦${_fmt(_loanEstimate!["repayment"])}'),
                _row('Net Profit', '₦${_fmt(_loanEstimate!["profit"])}'),
                const Divider(),
                const Text('Insurance: 2% premium (NAIC crop insurance)', style: TextStyle(fontSize: 12, color: Colors.grey)),
                const Text('Disbursement: Direct to input suppliers', style: TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ))),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: () {}, child: const Text('Apply via USSD *919*7#')),
          ],
        ],
      )),
    );
  }

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: const TextStyle(color: Colors.grey)), Text(value, style: const TextStyle(fontWeight: FontWeight.bold))]),
  );

  String _fmt(int v) => v.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');

  void _calculate() {
    setState(() => _isCalculating = true);
    final crop = _crops.firstWhere((c) => c['name'] == _selectedCrop);
    final hectares = int.tryParse(_hectaresController.text) ?? 1;
    final costPerHa = crop['costPerHa'] as int;
    final yieldPerHa = crop['yieldPerHa'] as int;
    final pricePerKg = crop['pricePerKg'] as int;

    Future.delayed(const Duration(seconds: 1), () {
      final amount = costPerHa * hectares;
      final yieldKg = yieldPerHa * hectares;
      final revenue = yieldKg * pricePerKg;
      final rate = 9; // CBN ABP rate
      final tenure = _selectedCrop == 'Cocoa' ? 12 : 8;
      final interest = (amount * rate * tenure) ~/ (100 * 12);
      final repayment = amount + interest;

      setState(() {
        _isCalculating = false;
        _loanEstimate = {
          'amount': amount, 'rate': rate, 'tenure': tenure,
          'yield': yieldKg, 'revenue': revenue, 'repayment': repayment,
          'profit': revenue - repayment,
        };
      });
    });
  }
}
