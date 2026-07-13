import '../../../utils/text_case_utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/scheduled_payment_provider.dart';
import '../../../providers/account_provider.dart';
import '../../../models/scheduled_payment.dart';
import '../../../config/app_theme.dart';

class ScheduledPaymentsScreen extends StatefulWidget {
  const ScheduledPaymentsScreen({super.key});

  @override
  State<ScheduledPaymentsScreen> createState() => _ScheduledPaymentsScreenState();
}

class _ScheduledPaymentsScreenState extends State<ScheduledPaymentsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _recipientController = TextEditingController();
  final _accountController = TextEditingController();
  final _bankController = TextEditingController();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _frequency = 'monthly';

  @override
  void initState() {
    super.initState();
    _loadPayments();
  }

  Future<void> _loadPayments() async {
    final account = context.read<AccountProvider>().activeAccount;
    if (account != null) {
      await context.read<ScheduledPaymentProvider>().fetchScheduledPayments(accountId: account.id);
    }
  }

  Future<void> _createPayment() async {
    if (!_formKey.currentState!.validate()) return;
    final account = context.read<AccountProvider>().activeAccount;
    if (account == null) return;
    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    final success = await context.read<ScheduledPaymentProvider>().createScheduledPayment(
          accountId: account.id,
          recipientName: _recipientController.text.trim(),
          recipientAccount: _accountController.text.trim(),
          recipientBank: _bankController.text.trim(),
          amount: amount,
          frequency: _frequency,
          startDate: DateTime.now(),
          description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
        );
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Scheduled payment created')),
      );
    } else {
      final error = context.read<ScheduledPaymentProvider>().error ?? 'Creation failed';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
    }
  }

  void _openCreateSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final bottomInset = MediaQuery.of(context).viewInsets.bottom;
        return Padding(
          padding: EdgeInsets.only(bottom: bottomInset),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('New Scheduled Payment', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: AppTheme.getTextPrimary(context))),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _recipientController,
                    decoration: const InputDecoration(labelText: 'Recipient name'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _accountController,
                    decoration: const InputDecoration(labelText: 'Recipient account number'),
                    keyboardType: TextInputType.number,
                    validator: (v) => (v == null || v.trim().length < 8) ? 'Enter a valid account' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _bankController,
                    decoration: const InputDecoration(labelText: 'Recipient bank'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _amountController,
                    decoration: const InputDecoration(labelText: 'Amount'),
                    keyboardType: TextInputType.number,
                    validator: (v) => (v == null || double.tryParse(v.trim()) == null) ? 'Enter amount' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _frequency,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'once', child: Text('One time')),
                      DropdownMenuItem(value: 'daily', child: Text('Daily')),
                      DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                      DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                      DropdownMenuItem(value: 'yearly', child: Text('Yearly')),
                    ],
                    onChanged: (v) => setState(() => _frequency = v ?? 'monthly'),
                    decoration: const InputDecoration(labelText: 'Frequency'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _descriptionController,
                    decoration: const InputDecoration(labelText: 'Description (optional)'),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _createPayment,
                      child: const Text('Create'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusChip(String status) {
    Color color;
    switch (status) {
      case 'active':
        color = Colors.green;
        break;
      case 'paused':
        color = Colors.orange;
        break;
      case 'cancelled':
        color = Colors.red;
        break;
      default:
        color = Colors.blueGrey;
    }
    return Chip(
      label: Text(toUpperCase(status), style: const TextStyle(color: Colors.white)),
      backgroundColor: color,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scheduled Payments')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateSheet,
        icon: const Icon(Icons.add_alarm_outlined),
        label: const Text('New Payment'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadPayments,
        child: Consumer<ScheduledPaymentProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading && provider.scheduledPayments.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }
            if (provider.scheduledPayments.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No scheduled payments yet')),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemBuilder: (context, index) {
                final ScheduledPayment payment = provider.scheduledPayments[index];
                return ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  tileColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.4),
                  title: Text(payment.recipientName, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppTheme.getTextPrimary(context))),
                  subtitle: Text('${payment.frequencyText} • ${payment.formattedAmount}', style: TextStyle(color: AppTheme.getTextSecondary(context))),
                  trailing: _buildStatusChip(payment.status),
                );
              },
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemCount: provider.scheduledPayments.length,
            );
          },
        ),
      ),
    );
  }
}
