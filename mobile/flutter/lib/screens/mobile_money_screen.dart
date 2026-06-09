import 'package:flutter/material.dart';

/// Mobile Money — Wallet management, cash-in/out, P2P transfers via phone number
class MobileMoneyScreen extends StatefulWidget {
  const MobileMoneyScreen({super.key});
  @override
  State<MobileMoneyScreen> createState() => _MobileMoneyScreenState();
}

class _MobileMoneyScreenState extends State<MobileMoneyScreen> {
  final _phoneController = TextEditingController();
  final _amountController = TextEditingController();
  String _action = ''; // send, request, cashin, cashout
  bool _isProcessing = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mobile Money')),
      body: SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Balance card
          Card(
            color: Colors.green.shade700,
            child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [
              const Text('Wallet Balance', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 8),
              const Text('₦1,250,000.00', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text('Tier 2 • Daily limit: ₦200,000', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12)),
            ])),
          ),
          const SizedBox(height: 20),
          // Actions grid
          Row(children: [
            _actionBtn(Icons.send, 'Send', 'send', Colors.blue),
            _actionBtn(Icons.call_received, 'Request', 'request', Colors.orange),
            _actionBtn(Icons.add_circle, 'Cash In', 'cashin', Colors.green),
            _actionBtn(Icons.remove_circle, 'Cash Out', 'cashout', Colors.red),
          ].map((w) => Expanded(child: Padding(padding: const EdgeInsets.all(4), child: w))).toList()),
          const SizedBox(height: 24),
          // Form
          if (_action.isNotEmpty) ...[
            Text(_action == 'send' ? 'Send Money' : _action == 'request' ? 'Request Money' : _action == 'cashin' ? 'Cash In' : 'Cash Out',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: InputDecoration(
              labelText: 'Phone Number', prefixText: '+234 ', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              helperText: 'MTN, Airtel, Glo, 9mobile',
            )),
            const SizedBox(height: 12),
            TextField(controller: _amountController, keyboardType: TextInputType.number, decoration: InputDecoration(
              labelText: 'Amount (₦)', prefixText: '₦ ', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            )),
            const SizedBox(height: 16),
            // Quick amounts
            Wrap(spacing: 8, runSpacing: 8, children: [500, 1000, 2000, 5000, 10000].map((a) =>
              ActionChip(label: Text('₦$a'), onPressed: () => setState(() => _amountController.text = a.toString()))).toList()),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isProcessing ? null : _process,
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
              child: _isProcessing ? const CircularProgressIndicator() : Text(_action == 'send' ? 'Send' : _action == 'request' ? 'Request' : 'Proceed'),
            ),
          ],
          // Recent
          const SizedBox(height: 24),
          const Text('Recent Activity', style: TextStyle(fontWeight: FontWeight.bold)),
          ListTile(dense: true, leading: const Icon(Icons.arrow_upward, color: Colors.red), title: const Text('Sent to +234801...678'), subtitle: const Text('Today 14:30'), trailing: const Text('-₦5,000')),
          ListTile(dense: true, leading: const Icon(Icons.arrow_downward, color: Colors.green), title: const Text('Received from +234809...432'), subtitle: const Text('Today 10:15'), trailing: const Text('+₦15,000')),
        ],
      )),
    );
  }

  Widget _actionBtn(IconData icon, String label, String action, Color color) => InkWell(
    onTap: () => setState(() => _action = action),
    child: Container(padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _action == action ? color.withOpacity(0.1) : null, borderRadius: BorderRadius.circular(12), border: Border.all(color: _action == action ? color : Colors.grey.shade300)),
      child: Column(children: [Icon(icon, color: color), const SizedBox(height: 4), Text(label, style: TextStyle(fontSize: 11, color: color))]),
    ),
  );

  void _process() {
    setState(() => _isProcessing = true);
    Future.delayed(const Duration(seconds: 2), () {
      setState(() { _isProcessing = false; _action = ''; });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transaction successful!'), backgroundColor: Colors.green));
    });
  }
}
