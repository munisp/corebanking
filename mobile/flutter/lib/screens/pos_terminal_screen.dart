import 'package:flutter/material.dart';

/// POS Terminal — Virtual point-of-sale with card acceptance and receipt generation
class PosTerminalScreen extends StatefulWidget {
  const PosTerminalScreen({super.key});
  @override
  State<PosTerminalScreen> createState() => _PosTerminalScreenState();
}

class _PosTerminalScreenState extends State<PosTerminalScreen> {
  final _amountController = TextEditingController();
  String _paymentMethod = 'card'; // card, nfc, qr
  bool _isProcessing = false;
  String _status = 'idle'; // idle, processing, approved, declined

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('POS Terminal'), backgroundColor: Colors.indigo),
      backgroundColor: Colors.grey.shade100,
      body: Center(child: Container(
        constraints: const BoxConstraints(maxWidth: 400),
        margin: const EdgeInsets.all(16),
        child: Card(elevation: 4, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
            // Amount display
            const Text('AMOUNT', style: TextStyle(fontSize: 12, color: Colors.grey, letterSpacing: 2)),
            const SizedBox(height: 8),
            TextField(
              controller: _amountController,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold),
              decoration: const InputDecoration(prefixText: '₦ ', border: InputBorder.none),
              keyboardType: TextInputType.number,
            ),
            const Divider(),
            // Payment method
            Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _methodBtn(Icons.credit_card, 'Card', 'card'),
              _methodBtn(Icons.contactless, 'NFC', 'nfc'),
              _methodBtn(Icons.qr_code, 'QR', 'qr'),
            ]),
            const SizedBox(height: 24),
            // Status
            if (_status == 'processing') const Column(children: [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('Processing...', style: TextStyle(color: Colors.grey)),
            ]),
            if (_status == 'approved') Column(children: [
              const Icon(Icons.check_circle, color: Colors.green, size: 64),
              const SizedBox(height: 8),
              const Text('APPROVED', style: TextStyle(color: Colors.green, fontSize: 24, fontWeight: FontWeight.bold)),
              Text('Ref: POS-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}'),
            ]),
            if (_status == 'declined') const Column(children: [
              Icon(Icons.cancel, color: Colors.red, size: 64),
              SizedBox(height: 8),
              Text('DECLINED', style: TextStyle(color: Colors.red, fontSize: 24, fontWeight: FontWeight.bold)),
              Text('Insufficient funds'),
            ]),
            if (_status == 'idle') ...[
              const SizedBox(height: 16),
              SizedBox(width: double.infinity, child: ElevatedButton(
                onPressed: _amountController.text.isNotEmpty ? _processPayment : null,
                style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, padding: const EdgeInsets.all(16)),
                child: const Text('CHARGE', style: TextStyle(fontSize: 18, color: Colors.white, letterSpacing: 2)),
              )),
            ],
            if (_status == 'approved' || _status == 'declined') ...[
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: OutlinedButton(onPressed: () => setState(() { _status = 'idle'; _amountController.clear(); }), child: const Text('New Sale'))),
                if (_status == 'approved') ...[const SizedBox(width: 12),
                  Expanded(child: ElevatedButton.icon(icon: const Icon(Icons.receipt), label: const Text('Receipt'), onPressed: () {}))],
              ]),
            ],
          ]))),
      )),
    );
  }

  Widget _methodBtn(IconData icon, String label, String method) => InkWell(
    onTap: () => setState(() => _paymentMethod = method),
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _paymentMethod == method ? Colors.indigo.withOpacity(0.1) : null,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _paymentMethod == method ? Colors.indigo : Colors.grey.shade300),
      ),
      child: Column(children: [Icon(icon, color: _paymentMethod == method ? Colors.indigo : Colors.grey), const SizedBox(height: 4), Text(label, style: TextStyle(fontSize: 11, color: _paymentMethod == method ? Colors.indigo : Colors.grey))]),
    ),
  );

  void _processPayment() {
    setState(() => _status = 'processing');
    Future.delayed(const Duration(seconds: 2), () {
      setState(() => _status = (int.tryParse(_amountController.text) ?? 0) > 5000000 ? 'declined' : 'approved');
    });
  }
}
