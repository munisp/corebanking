import '../../../utils/text_case_utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/cheque_provider.dart';
import '../../../providers/account_provider.dart';
import '../../../models/cheque.dart';
import '../../../config/app_theme.dart';

class ChequesScreen extends StatefulWidget {
  const ChequesScreen({super.key});

  @override
  State<ChequesScreen> createState() => _ChequesScreenState();
}

class _ChequesScreenState extends State<ChequesScreen> {
  final _formKey = GlobalKey<FormState>();
  final _addressController = TextEditingController();
  final _branchController = TextEditingController();
  String _deliveryMethod = 'courier';
  int _numberOfLeaves = 25;

  @override
  void initState() {
    super.initState();
    _loadCheques();
  }

  Future<void> _loadCheques() async {
    final account = context.read<AccountProvider>().activeAccount;
    if (account != null) {
      await context.read<ChequeProvider>().fetchCheques(accountId: account.id);
    }
  }

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate()) return;
    final account = context.read<AccountProvider>().activeAccount;
    if (account == null) return;
    final success = await context.read<ChequeProvider>().requestChequeBook(
          accountId: account.id,
          numberOfLeaves: _numberOfLeaves,
          deliveryMethod: _deliveryMethod,
          deliveryAddress: _deliveryMethod == 'courier' ? _addressController.text.trim() : null,
          branchName: _deliveryMethod == 'branch' ? _branchController.text.trim() : null,
        );
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cheque book request submitted')),
      );
    } else {
      final error = context.read<ChequeProvider>().error ?? 'Request failed';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error)),
      );
    }
  }

  void _openRequestSheet() {
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
                  Text('Request Cheque Book', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: AppTheme.getTextPrimary(context))),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    initialValue: _numberOfLeaves,
                    items: const [25, 50].map((v) => DropdownMenuItem(value: v, child: Text('$v leaves'))).toList(),
                    onChanged: (v) => setState(() => _numberOfLeaves = v ?? 25),
                    decoration: const InputDecoration(labelText: 'Number of leaves'),
                  ),
                  const SizedBox(height: 12),
                  Text('Delivery method', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.getTextSecondary(context))),
                  Row(
                    children: [
                      Radio<String>(
                        value: 'courier',
                        groupValue: _deliveryMethod,
                        onChanged: (v) => setState(() => _deliveryMethod = v ?? 'courier'),
                      ),
                      const Text('Courier'),
                      const SizedBox(width: 16),
                      Radio<String>(
                        value: 'branch',
                        groupValue: _deliveryMethod,
                        onChanged: (v) => setState(() => _deliveryMethod = v ?? 'branch'),
                      ),
                      const Text('Pick up at branch'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_deliveryMethod == 'courier')
                    TextFormField(
                      controller: _addressController,
                      decoration: const InputDecoration(labelText: 'Delivery address'),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Address required' : null,
                    ),
                  if (_deliveryMethod == 'branch')
                    TextFormField(
                      controller: _branchController,
                      decoration: const InputDecoration(labelText: 'Preferred branch'),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Branch required' : null,
                    ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _submitRequest,
                      child: const Text('Submit request'),
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
      case 'delivered':
        color = Colors.green;
        break;
      case 'issued':
        color = Colors.blue;
        break;
      case 'stopped':
        color = Colors.red;
        break;
      default:
        color = Colors.orange;
    }
    return Chip(
      label: Text(toUpperCase(status), style: const TextStyle(color: Colors.white)),
      backgroundColor: color,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cheques')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openRequestSheet,
        icon: const Icon(Icons.note_add_outlined),
        label: const Text('Request Cheque'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadCheques,
        child: Consumer<ChequeProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading && provider.cheques.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }
            if (provider.cheques.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No cheques yet')),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemBuilder: (context, index) {
                final Cheque cheque = provider.cheques[index];
                return ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  tileColor: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.4),
                  title: Text('Cheque ${cheque.chequeNumber}', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppTheme.getTextPrimary(context))),
                  subtitle: Text('Requested: ${cheque.requestDate.toLocal().toString().split(' ').first}', style: TextStyle(color: AppTheme.getTextSecondary(context))),
                  trailing: _buildStatusChip(cheque.status),
                );
              },
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemCount: provider.cheques.length,
            );
          },
        ),
      ),
    );
  }
}
