import 'package:flutter/material.dart';
import '../../../config/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../../services/mortgage_service.dart';
import '../../../services/local_storage_service.dart';
import 'dart:convert';

class MortgageApplicationScreen extends StatefulWidget {
  const MortgageApplicationScreen({super.key});

  @override
  State<MortgageApplicationScreen> createState() =>
      _MortgageApplicationScreenState();
}

class _MortgageApplicationScreenState extends State<MortgageApplicationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _propertyAddressController = TextEditingController();
  final _propertyValueController = TextEditingController();
  final _loanAmountController = TextEditingController();
  final _downPaymentController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _monthlyGrossIncomeController = TextEditingController();

  String _productType = 'fixed_rate';
  String _propertyType = 'House';
  String _employmentType = '';
  int _loanTerm = 20;
  bool _isLoading = false;

  // Map server enum values to user-friendly labels
  final Map<String, String> _productTypeOptions = {
    'fixed_rate': 'Fixed Rate',
    'variable_rate': 'Variable Rate',
    'nhf_backed': 'NHF Backed',
    'fmbn_backed': 'FMBN Backed',
    'construction_loan': 'Construction Loan',
    'equity_release': 'Equity Release',
    'buy_to_let': 'Buy to Let',
  };

  final List<String> _propertyTypes = [
    'House',
    'Apartment',
    'Land',
    'Commercial',
  ];

  @override
  void dispose() {
    _propertyAddressController.dispose();
    _propertyValueController.dispose();
    _loanAmountController.dispose();
    _downPaymentController.dispose();
    _descriptionController.dispose();
    _monthlyGrossIncomeController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isLoading = true);

    try {
      // Get user info from local storage
      final userJson = await LocalStorageService.getString('user');
      String applicantId = '';
      String applicantName = '';
      
      if (userJson != null) {
        final user = jsonDecode(userJson);
        applicantId = user['id'] ?? '';
        final firstName = user['first_name'] ?? '';
        final lastName = user['last_name'] ?? '';
        applicantName = (firstName + ' ' + lastName).trim();
      }

      // Prepare payload with snake_case keys to match Go backend
      final payload = {
        'product_type': _productType,
        'primary_applicant_id': applicantId,
        'primary_applicant_name': applicantName,
        'requested_amount': double.tryParse(_loanAmountController.text.replaceAll(',', '')) ?? 0,
        'requested_tenor_months': _loanTerm * 12,
        'down_payment': double.tryParse(_downPaymentController.text.replaceAll(',', '')) ?? 0,
        'property_address': _propertyAddressController.text.trim(),
        'property_type': _propertyType,
        'property_value': double.tryParse(_propertyValueController.text.replaceAll(',', '')) ?? 0,
        'description': _descriptionController.text.trim(),
        if (_employmentType.isNotEmpty) 'employment_type': _employmentType,
        if (_monthlyGrossIncomeController.text.isNotEmpty)
          'monthly_gross_income': double.tryParse(_monthlyGrossIncomeController.text.replaceAll(',', '')) ?? 0,
      };

      await MortgageService.instance.applyForMortgage(payload);

      if (!mounted) return;

      setState(() => _isLoading = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mortgage application submitted successfully!'),
          backgroundColor: AppTheme.successColor,
        ),
      );

      Navigator.pop(context, true);
    } catch (e) {
      setState(() => _isLoading = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to submit application: $e'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    }
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppTheme.getTextPrimary(context),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.applyForMortgage),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Mortgage Product Type Dropdown
              _buildLabel('Mortgage Product Type'),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _productType,
                items: _productTypeOptions.entries
                    .map((entry) => DropdownMenuItem<String>(
                          value: entry.key,
                          child: Text(entry.value),
                        ))
                    .toList(),
                onChanged: (value) {
                  setState(() {
                    _productType = value!;
                  });
                },
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.category_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                validator: (value) => 
                    value == null || value.isEmpty ? 'Please select a product type' : null,
              ),
              const SizedBox(height: 20),

              // Property Type Dropdown
              _buildLabel(l10n.propertyType),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _propertyType,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.home_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: _propertyTypes.map((type) {
                  return DropdownMenuItem(value: type, child: Text(type));
                }).toList(),
                onChanged: (value) {
                  setState(() => _propertyType = value!);
                },
                validator: (value) => 
                    value == null || value.isEmpty ? 'Please select property type' : null,
              ),
              const SizedBox(height: 20),

              // Property Address
              _buildLabel(l10n.propertyAddress),
              const SizedBox(height: 8),
              TextFormField(
                controller: _propertyAddressController,
                decoration: InputDecoration(
                  hintText: '123 Lekki Peninsula, Lagos',
                  prefixIcon: const Icon(Icons.location_on_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter property address';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Property Value
              _buildLabel(l10n.propertyValue),
              const SizedBox(height: 8),
              TextFormField(
                controller: _propertyValueController,
                decoration: InputDecoration(
                  hintText: '45000000',
                  prefixIcon: const Icon(Icons.account_balance_outlined),
                  prefixText: '₦ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter property value';
                  }
                  final amount = double.tryParse(value.replaceAll(',', ''));
                  if (amount == null || amount <= 0) {
                    return 'Please enter a valid amount';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Loan Amount (what the user wants to borrow — separate from property value)
              _buildLabel('Loan Amount (₦)'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _loanAmountController,
                decoration: InputDecoration(
                  hintText: '36000000',
                  prefixIcon: const Icon(Icons.monetization_on_outlined),
                  prefixText: '₦ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter the loan amount you require';
                  }
                  final amount = double.tryParse(value.replaceAll(',', ''));
                  if (amount == null || amount <= 0) {
                    return 'Please enter a valid amount';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Down Payment
              _buildLabel(l10n.downPayment),
              const SizedBox(height: 8),
              TextFormField(
                controller: _downPaymentController,
                decoration: InputDecoration(
                  hintText: '9000000',
                  prefixIcon: const Icon(Icons.account_balance_wallet_outlined),
                  prefixText: '₦ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter down payment';
                  }
                  final amount = double.tryParse(value.replaceAll(',', ''));
                  if (amount == null || amount <= 0) {
                    return 'Please enter a valid amount';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Loan Term Slider
              _buildLabel('${l10n.loanTerm} ($_loanTerm years)'),
              const SizedBox(height: 8),
              Slider(
                value: _loanTerm.toDouble(),
                min: 5,
                max: 30,
                divisions: 25,
                label: '$_loanTerm years',
                onChanged: (value) {
                  setState(() => _loanTerm = value.toInt());
                },
              ),
              const SizedBox(height: 20),

              // Employment Type (Optional)
              _buildLabel('Employment Type (Optional)'),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _employmentType.isEmpty ? null : _employmentType,
                hint: const Text('Select employment type'),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.work_outline),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: const [
                  DropdownMenuItem(value: 'employed', child: Text('Employed')),
                  DropdownMenuItem(value: 'self_employed', child: Text('Self Employed')),
                  DropdownMenuItem(value: 'business_owner', child: Text('Business Owner')),
                  DropdownMenuItem(value: 'contract', child: Text('Contract')),
                  DropdownMenuItem(value: 'retired', child: Text('Retired')),
                ],
                onChanged: (value) => setState(() => _employmentType = value ?? ''),
              ),
              const SizedBox(height: 20),

              // Monthly Gross Income (Optional)
              _buildLabel('Monthly Gross Income (Optional)'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _monthlyGrossIncomeController,
                decoration: InputDecoration(
                  hintText: '500000',
                  prefixIcon: const Icon(Icons.payments_outlined),
                  prefixText: '₦ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 20),

              // Description (Optional)
              _buildLabel('${l10n.description} (Optional)'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _descriptionController,
                decoration: InputDecoration(
                  hintText: 'Additional details...',
                  prefixIcon: const Icon(Icons.description_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
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
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(
                          l10n.submitApplication,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}