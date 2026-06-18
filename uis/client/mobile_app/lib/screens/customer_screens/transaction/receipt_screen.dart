import 'package:flutter/material.dart';

class ReceiptScreen extends StatelessWidget {
  const ReceiptScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final ref = args?['reference'] ?? 'REF123456';
    final amount = args?['amount'] ?? 15000;
    final beneficiary = args?['beneficiary'] ?? 'IKEDC';

    return Scaffold(
      appBar: AppBar(title: const Text('Receipt')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 24),
            const Text(
              'Payment Receipt',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            _row('Reference', ref),
            _row('Beneficiary', beneficiary),
            _row('Amount', '₦$amount'),
            _row('Status', 'Success'),
            const Spacer(),
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                onPressed: () async {
                  // final receiptData = await _apiService.get('/transactions/${transactionId}/receipt');
                  // Share receipt PDF/image
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Receipt sharing functionality coming soon')),
                    );
                  }
                },
                icon: const Icon(Icons.share_outlined),
                label: const Text('Share Receipt'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
