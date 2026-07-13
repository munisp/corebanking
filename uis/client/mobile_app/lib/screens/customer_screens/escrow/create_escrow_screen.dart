import 'package:flutter/material.dart';
import '../../../config/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../../services/escrow_service.dart';

class CreateEscrowScreen extends StatefulWidget {
  const CreateEscrowScreen({super.key});

  @override
  State<CreateEscrowScreen> createState() => _CreateEscrowScreenState();
}

class _CreateEscrowScreenState extends State<CreateEscrowScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _buyerNameController = TextEditingController();
  final _buyerEmailController = TextEditingController();
  final _sellerNameController = TextEditingController();
  final _sellerEmailController = TextEditingController();
  final _sellerAccountNumberController = TextEditingController();
  final _sellerBankController = TextEditingController();
  final _conditionsController = TextEditingController();
  final _descriptionController = TextEditingController();

  String _selectedType = 'Property Transaction';
  bool _isLoading = false;

  final List<String> _escrowTypes = [
    'Property Transaction',
    'Service Payment',
    'Contract Deposit',
  ];

  // Additional parties beyond the required buyer + seller
  final List<_AdditionalParty> _additionalParties = [];

  final List<String> _additionalRoles = [
    'agent',
    'arbitrator',
    'logistics',
    'inspector',
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _amountController.dispose();
    _buyerNameController.dispose();
    _buyerEmailController.dispose();
    _sellerNameController.dispose();
    _sellerEmailController.dispose();
    _sellerAccountNumberController.dispose();
    _sellerBankController.dispose();
    _conditionsController.dispose();
    _descriptionController.dispose();
    for (final p in _additionalParties) {
      p.nameController.dispose();
      p.emailController.dispose();
      p.splitController.dispose();
    }
    super.dispose();
  }

  void _addParty() {
    setState(() {
      _additionalParties.add(_AdditionalParty(role: _additionalRoles.first));
    });
  }

  void _removeParty(int index) {
    setState(() {
      _additionalParties[index].nameController.dispose();
      _additionalParties[index].emailController.dispose();
      _additionalParties[index].splitController.dispose();
      _additionalParties.removeAt(index);
    });
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final user = await EscrowService.instance.getLocalUser();
      if (user == null || user.id.isEmpty) {
        throw Exception('No valid local user found');
      }

      final parties = <Map<String, dynamic>>[
        {
          'role': 'buyer',
          'name': _buyerNameController.text,
          'email': _buyerEmailController.text,
        },
        {
          'role': 'seller',
          'name': _sellerNameController.text,
          'email': _sellerEmailController.text,
          'account_number': _sellerAccountNumberController.text,
          'bank_code': _sellerBankController.text,
        },
        for (final p in _additionalParties)
          if (p.nameController.text.isNotEmpty)
            {
              'role': p.role,
              'name': p.nameController.text,
              'email': p.emailController.text,
              if (p.splitController.text.isNotEmpty)
                'split_percentage': double.tryParse(p.splitController.text),
            },
      ];

      final input = {
        'title': _titleController.text,
        'type': _selectedType,
        'use_case': 'freelance',
        'total_amount': double.tryParse(_amountController.text) ?? 0,
        'currency': 'NGN',
        'description': _descriptionController.text,
        'release_conditions': _conditionsController.text,
        'user_id': user.id,
        'parties': parties,
      };
      await EscrowService.instance.createContract(input);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Escrow created successfully!'),
          backgroundColor: AppTheme.successColor,
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create escrow: $e'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.createEscrow),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title
              _buildLabel('Escrow Title'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _titleController,
                decoration: InputDecoration(
                  hintText: 'e.g., Property Purchase - Lagos',
                  prefixIcon: const Icon(Icons.title_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (value) => (value == null || value.trim().isEmpty) ? 'Please enter a title' : null,
              ),
              const SizedBox(height: 20),

              // Escrow Type
              _buildLabel(l10n.escrowType),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _selectedType,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.category_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                items: _escrowTypes.map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                onChanged: (value) => setState(() => _selectedType = value!),
              ),
              const SizedBox(height: 20),

              // Amount
              _buildLabel(l10n.amount),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountController,
                decoration: InputDecoration(
                  hintText: '1000000',
                  prefixIcon: const Icon(Icons.account_balance_wallet_outlined),
                  prefixText: '₦ ',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return 'Please enter amount';
                  final amount = double.tryParse(value.replaceAll(',', ''));
                  if (amount == null || amount <= 0) return 'Please enter a valid amount';
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Buyer Information
              Text('Buyer Information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context))),
              const SizedBox(height: 16),

              _buildLabel('Buyer Name'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _buyerNameController,
                decoration: InputDecoration(
                  hintText: 'John Doe',
                  prefixIcon: const Icon(Icons.person_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (value) => (value == null || value.trim().isEmpty) ? 'Please enter buyer name' : null,
              ),
              const SizedBox(height: 16),

              _buildLabel('Buyer Email'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _buyerEmailController,
                decoration: InputDecoration(
                  hintText: 'buyer@example.com',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return 'Please enter buyer email';
                  if (!value.contains('@')) return 'Please enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Seller Information
              Text('Seller Information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context))),
              const SizedBox(height: 16),

              _buildLabel('Seller Name'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _sellerNameController,
                decoration: InputDecoration(
                  hintText: 'Jane Smith',
                  prefixIcon: const Icon(Icons.person_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (value) => (value == null || value.trim().isEmpty) ? 'Please enter seller name' : null,
              ),
              const SizedBox(height: 16),

              _buildLabel('Seller Email'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _sellerEmailController,
                decoration: InputDecoration(
                  hintText: 'seller@example.com',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return 'Please enter seller email';
                  if (!value.contains('@')) return 'Please enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              _buildLabel('Seller Account Number'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _sellerAccountNumberController,
                decoration: InputDecoration(
                  hintText: '0123456789',
                  prefixIcon: const Icon(Icons.account_balance_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                keyboardType: TextInputType.number,
                maxLength: 10,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return 'Please enter seller account number';
                  if (value.length != 10) return 'Account number must be 10 digits';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              _buildLabel('Seller Bank'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _sellerBankController,
                decoration: InputDecoration(
                  hintText: 'e.g., Access Bank, GTBank',
                  prefixIcon: const Icon(Icons.account_balance_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (value) => (value == null || value.trim().isEmpty) ? 'Please enter seller bank' : null,
              ),
              const SizedBox(height: 24),

              // Additional Parties Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Additional Parties',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.getTextPrimary(context)),
                  ),
                  TextButton.icon(
                    onPressed: _addParty,
                    icon: const Icon(Icons.add),
                    label: const Text('Add Party'),
                  ),
                ],
              ),
              if (_additionalParties.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: Text(
                    'Optionally add agents, arbitrators, logistics providers, or inspectors.',
                    style: TextStyle(color: AppTheme.getTextSecondary(context), fontSize: 13),
                  ),
                ),
              for (int i = 0; i < _additionalParties.length; i++)
                _AdditionalPartyCard(
                  index: i,
                  party: _additionalParties[i],
                  roles: _additionalRoles,
                  onRemove: () => _removeParty(i),
                  onRoleChanged: (role) => setState(() => _additionalParties[i].role = role),
                ),
              const SizedBox(height: 24),

              // Release Conditions
              _buildLabel(l10n.releaseConditions),
              const SizedBox(height: 8),
              TextFormField(
                controller: _conditionsController,
                decoration: InputDecoration(
                  hintText: 'e.g., Property title transfer completed',
                  prefixIcon: const Icon(Icons.rule_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                maxLines: 3,
                validator: (value) => (value == null || value.trim().isEmpty) ? 'Please enter release conditions' : null,
              ),
              const SizedBox(height: 20),

              // Description
              _buildLabel('${l10n.description} (Optional)'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descriptionController,
                decoration: InputDecoration(
                  hintText: 'Additional details about this escrow...',
                  prefixIcon: const Icon(Icons.description_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                maxLines: 4,
              ),
              const SizedBox(height: 32),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                        )
                      : Text(l10n.createEscrow, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.getTextPrimary(context)),
    );
  }
}

class _AdditionalParty {
  String role;
  final TextEditingController nameController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController splitController = TextEditingController();

  _AdditionalParty({required this.role});
}

class _AdditionalPartyCard extends StatelessWidget {
  final int index;
  final _AdditionalParty party;
  final List<String> roles;
  final VoidCallback onRemove;
  final ValueChanged<String> onRoleChanged;

  const _AdditionalPartyCard({
    required this.index,
    required this.party,
    required this.roles,
    required this.onRemove,
    required this.onRoleChanged,
  });

  String _roleLabel(String role) {
    switch (role) {
      case 'agent': return 'Agent';
      case 'arbitrator': return 'Arbitrator';
      case 'logistics': return 'Logistics Provider';
      case 'inspector': return 'Inspector';
      default: return role;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Party ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w600)),
                IconButton(icon: const Icon(Icons.close, size: 18), onPressed: onRemove, padding: EdgeInsets.zero),
              ],
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: party.role,
              decoration: InputDecoration(
                labelText: 'Role',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              items: roles.map((r) => DropdownMenuItem(value: r, child: Text(_roleLabel(r)))).toList(),
              onChanged: (value) { if (value != null) onRoleChanged(value); },
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: party.nameController,
              decoration: InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: party.emailController,
              decoration: InputDecoration(
                labelText: 'Email (optional)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: party.splitController,
              decoration: InputDecoration(
                labelText: 'Split % (optional)',
                suffixText: '%',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
          ],
        ),
      ),
    );
  }
}
