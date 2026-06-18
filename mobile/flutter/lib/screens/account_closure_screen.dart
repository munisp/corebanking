import 'package:flutter/material.dart';

class AccountClosureScreen extends StatefulWidget {
  const AccountClosureScreen({super.key});
  @override
  State<AccountClosureScreen> createState() => _AccountClosureScreenState();
}

class _AccountClosureScreenState extends State<AccountClosureScreen> {
  String _selectedReason = 'Relocating';
  bool _confirmChecklist = false;
  bool _acknowledgeForfeiture = false;
  double _remainingBalance = 245670.50;

  final List<String> _reasons = [
    'Relocating',
    'Better rates elsewhere',
    'Service dissatisfaction',
    'Account consolidation',
    'Deceased account holder',
    'Fraudulent account',
  ];

  final List<Map<String, dynamic>> _checklist = [
    {'item': 'Cancel all standing orders', 'done': true},
    {'item': 'Close linked cards', 'done': true},
    {'item': 'Transfer remaining balance', 'done': false},
    {'item': 'Download final statement', 'done': false},
    {'item': 'Return cheque book (if any)', 'done': true},
    {'item': 'Deactivate mobile/internet banking', 'done': false},
  ];

  @override
  Widget build(BuildContext context) {
    int completedItems = _checklist.where((c) => c['done'] == true).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Account Closure')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              color: Colors.orange.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(children: [
                  const Icon(Icons.warning_amber, color: Colors.orange),
                  const SizedBox(width: 12),
                  Expanded(child: Text(
                    'Account closure is irreversible. Remaining balance: \u20A6${_remainingBalance.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  )),
                ]),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Reason for Closure', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedReason,
              items: _reasons.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
              onChanged: (v) => setState(() => _selectedReason = v!),
              decoration: const InputDecoration(border: OutlineInputBorder()),
            ),
            const SizedBox(height: 24),
            Text('Pre-Closure Checklist ($completedItems/${_checklist.length})',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...List.generate(_checklist.length, (i) => CheckboxListTile(
              title: Text(_checklist[i]['item']),
              value: _checklist[i]['done'],
              onChanged: (v) => setState(() => _checklist[i]['done'] = v),
              controlAffinity: ListTileControlAffinity.leading,
            )),
            const SizedBox(height: 16),
            CheckboxListTile(
              title: const Text('I confirm all obligations are settled'),
              value: _confirmChecklist,
              onChanged: (v) => setState(() => _confirmChecklist = v!),
            ),
            CheckboxListTile(
              title: const Text('I acknowledge forfeiture of loyalty points and benefits'),
              value: _acknowledgeForfeiture,
              onChanged: (v) => setState(() => _acknowledgeForfeiture = v!),
            ),
            const SizedBox(height: 24),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: (_confirmChecklist && _acknowledgeForfeiture && completedItems == _checklist.length)
                ? () => _submitClosure(context) : null,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Submit Closure Request', style: TextStyle(color: Colors.white)),
              ),
            )),
            const SizedBox(height: 8),
            const Center(child: Text('CBN 30-day cooling period applies', style: TextStyle(color: Colors.grey))),
          ],
        ),
      ),
    );
  }

  void _submitClosure(BuildContext context) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Confirm Closure'),
      content: Text('Close account? Reason: $_selectedReason\nRemaining \u20A6${_remainingBalance.toStringAsFixed(2)} will be transferred to your nominated account.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        TextButton(onPressed: () { Navigator.pop(ctx); ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Closure request submitted. 30-day cooling period starts.')));
        }, child: const Text('Confirm', style: TextStyle(color: Colors.red))),
      ],
    ));
  }
}
