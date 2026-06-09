import 'package:flutter/material.dart';

/// WhatsApp Payment Integration — Configure WhatsApp Business payment notifications and triggers
class WhatsappPaymentIntegrationScreen extends StatefulWidget {
  const WhatsappPaymentIntegrationScreen({super.key});
  @override
  State<WhatsappPaymentIntegrationScreen> createState() => _WhatsappPaymentIntegrationScreenState();
}

class _WhatsappPaymentIntegrationScreenState extends State<WhatsappPaymentIntegrationScreen> {
  bool _creditAlert = true;
  bool _debitAlert = true;
  bool _billReminder = true;
  bool _loginAlert = false;
  final _phoneController = TextEditingController(text: '+234 801 234 5678');
  bool _verified = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('WhatsApp Notifications')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Status card
        Card(color: _verified ? Colors.green.shade50 : Colors.orange.shade50, child: ListTile(
          leading: Icon(_verified ? Icons.verified : Icons.warning, color: _verified ? Colors.green : Colors.orange),
          title: Text(_verified ? 'Connected' : 'Verification Needed'),
          subtitle: Text(_phoneController.text),
          trailing: _verified ? null : TextButton(onPressed: () {}, child: const Text('Verify')),
        )),
        const SizedBox(height: 16),
        // Phone number
        TextField(controller: _phoneController, decoration: InputDecoration(
          labelText: 'WhatsApp Number',
          prefixIcon: const Icon(Icons.phone),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        )),
        const SizedBox(height: 24),
        const Text('Alert Preferences', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        SwitchListTile(title: const Text('Credit Alerts'), subtitle: const Text('Notify when money is received'),
            value: _creditAlert, onChanged: (v) => setState(() => _creditAlert = v)),
        SwitchListTile(title: const Text('Debit Alerts'), subtitle: const Text('Notify when money is sent'),
            value: _debitAlert, onChanged: (v) => setState(() => _debitAlert = v)),
        SwitchListTile(title: const Text('Bill Reminders'), subtitle: const Text('Remind 3 days before due date'),
            value: _billReminder, onChanged: (v) => setState(() => _billReminder = v)),
        SwitchListTile(title: const Text('Login Alerts'), subtitle: const Text('Notify on new device login'),
            value: _loginAlert, onChanged: (v) => setState(() => _loginAlert = v)),
        const SizedBox(height: 24),
        const Text('Message Preview', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(12)),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('54Bank', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
            SizedBox(height: 4),
            Text('Credit Alert\nAmount: NGN 1,500,000.00\nFrom: PAYROLL/ACME LTD\nBalance: NGN 3,450,000.00\nRef: NIP/UBA/20260609/045\nDate: 09-Jun-2026 10:15',
                style: TextStyle(fontSize: 13)),
          ]),
        ),
      ]),
    );
  }
}
