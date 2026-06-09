import 'package:flutter/material.dart';

/// Payment Investigation — Trace failed/pending transactions, dispute filing, NIP reversal
class PaymentInvestigationScreen extends StatefulWidget {
  const PaymentInvestigationScreen({super.key});
  @override
  State<PaymentInvestigationScreen> createState() => _PaymentInvestigationScreenState();
}

class _PaymentInvestigationScreenState extends State<PaymentInvestigationScreen> {
  final _refController = TextEditingController();
  bool _isSearching = false;
  Map<String, dynamic>? _result;
  String _disputeReason = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Payment Investigation')),
      body: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Trace a Transaction', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Enter the transaction reference or session ID to investigate.', style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 16),
          TextField(
            controller: _refController,
            decoration: InputDecoration(
              labelText: 'Transaction Reference / NIP Session ID',
              hintText: 'e.g., NIP/54B/20260609/001',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _search),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            icon: _isSearching ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.track_changes),
            label: Text(_isSearching ? 'Tracing...' : 'Trace Transaction'),
            onPressed: _isSearching ? null : _search,
          ),
          if (_result != null) ...[
            const SizedBox(height: 24),
            // Timeline
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Status: ${_result!["status"]}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold,
                    color: _result!['status'] == 'FAILED' ? Colors.red : _result!['status'] == 'PENDING' ? Colors.orange : Colors.green)),
                const Divider(),
                _timelineStep('Initiated', '2026-06-09 14:30:00', true),
                _timelineStep('Debited Sender', '2026-06-09 14:30:01', true),
                _timelineStep('Sent to NIBSS', '2026-06-09 14:30:02', true),
                _timelineStep('Credited Recipient', '2026-06-09 14:30:05', _result!['status'] == 'SUCCESS'),
                _timelineStep('Confirmation', '2026-06-09 14:30:06', _result!['status'] == 'SUCCESS'),
                const Divider(),
                Text('Failure Reason: ${_result!["reason"] ?? "N/A"}', style: const TextStyle(color: Colors.red)),
                Text('NIBSS Response: ${_result!["nibss_code"] ?? "00"}'),
                Text('Session ID: ${_result!["session_id"]}'),
              ],
            ))),
            const SizedBox(height: 16),
            // Actions
            if (_result!['status'] != 'SUCCESS') ...[
              const Text('Resolution Options:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              OutlinedButton.icon(icon: const Icon(Icons.replay), label: const Text('Request NIP Reversal'),
                  onPressed: () => _showDisputeDialog('reversal')),
              const SizedBox(height: 8),
              OutlinedButton.icon(icon: const Icon(Icons.report_problem), label: const Text('File Dispute (CBN 72hr SLA)'),
                  onPressed: () => _showDisputeDialog('dispute')),
              const SizedBox(height: 8),
              OutlinedButton.icon(icon: const Icon(Icons.support_agent), label: const Text('Escalate to Support'), onPressed: () {}),
            ],
          ],
        ],
      )),
    );
  }

  Widget _timelineStep(String label, String time, bool completed) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
      Icon(completed ? Icons.check_circle : Icons.radio_button_unchecked, size: 16, color: completed ? Colors.green : Colors.grey),
      const SizedBox(width: 8),
      Expanded(child: Text(label)),
      Text(time, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ]));
  }

  void _search() {
    if (_refController.text.isEmpty) return;
    setState(() => _isSearching = true);
    Future.delayed(const Duration(seconds: 2), () {
      setState(() {
        _isSearching = false;
        _result = {
          'status': 'FAILED',
          'reason': 'Beneficiary account not found (NIBSS 12)',
          'nibss_code': '12',
          'session_id': 'NIP${DateTime.now().millisecondsSinceEpoch}',
          'amount': 500000,
          'sender': '54Bank - 1000000001',
          'recipient': 'GTBank - 0123456789',
        };
      });
    });
  }

  void _showDisputeDialog(String type) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: Text(type == 'reversal' ? 'Request NIP Reversal' : 'File Dispute'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(type == 'reversal' ? 'This will send a reversal request via NIBSS. Processing time: 24-48 hours.' : 'CBN mandates resolution within 72 hours for intra-bank and 14 days for inter-bank disputes.'),
        const SizedBox(height: 12),
        TextField(maxLines: 3, decoration: const InputDecoration(labelText: 'Additional Details', border: OutlineInputBorder()),
            onChanged: (v) => _disputeReason = v),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ElevatedButton(onPressed: () { Navigator.pop(ctx); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${type == "reversal" ? "Reversal" : "Dispute"} submitted successfully'))); },
            child: const Text('Submit')),
      ],
    ));
  }
}
