import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../services/loan_service.dart';
import '../../../services/api_service.dart';

class LoansApplicationScreen extends StatefulWidget {
  const LoansApplicationScreen({super.key});

  @override
  State<LoansApplicationScreen> createState() => _LoansApplicationScreenState();
}

class _LoansApplicationScreenState extends State<LoansApplicationScreen> {
  final LoanService _loanService = LoanService(ApiService());
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;

  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _termController = TextEditingController();
  final TextEditingController _purposeController = TextEditingController();

  String? _selectedPurpose;
  final List<String> _loanPurposes = [
    'Business Expansion',
    'Working Capital',
    'Equipment Purchase',
    'Inventory',
    'Property Purchase',
    'Emergency Funds',
    'Other',
  ];

  double _estimatedInterest = 0.0;
  double _monthlyPayment = 0.0;
  double _totalAmount = 0.0;
  final double _interestRate = 15.0; // Annual interest rate

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_calculateLoan);
    _termController.addListener(_calculateLoan);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _termController.dispose();
    _purposeController.dispose();
    super.dispose();
  }

  void _calculateLoan() {
    final amount = double.tryParse(_amountController.text) ?? 0;
    final term = int.tryParse(_termController.text) ?? 0;

    if (amount > 0 && term > 0) {
      final monthlyRate = _interestRate / 100 / 12;
      final totalInterest = amount * (_interestRate / 100) * (term / 12);
      final totalAmount = amount + totalInterest;
      
      setState(() {
        _estimatedInterest = totalInterest;
        _monthlyPayment = totalAmount / term;
        _totalAmount = totalAmount;
      });
    } else {
      setState(() {
        _estimatedInterest = 0.0;
        _monthlyPayment = 0.0;
        _totalAmount = 0.0;
      });
    }
  }

  Future<void> _applyForLoan() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    final amount = double.parse(_amountController.text);
    final term = int.parse(_termController.text);
    final purpose = _selectedPurpose == 'Other' 
        ? _purposeController.text 
        : _selectedPurpose!;

    try {
      final response = await _loanService.applyForLoan(
        amount: amount,
        termInMonths: term,
        purpose: purpose,
      );

      if (!mounted) return;

      // Show success dialog
      final theme = Theme.of(context);
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.check_circle, color: theme.colorScheme.primary, size: 32),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Application Submitted!',
                  style: TextStyle(fontSize: 20),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your loan application has been submitted successfully. We will review it and get back to you shortly.',
                style: TextStyle(fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: theme.colorScheme.outline.withOpacity(0.2)),
                ),
                child: Column(
                  children: [
                    _summaryRow('Loan Amount', '₦${amount.toStringAsFixed(2)}', theme),
                    _summaryRow('Term', '$term months', theme),
                    _summaryRow('Monthly Payment', '₦${_monthlyPayment.toStringAsFixed(2)}', theme),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                Navigator.of(context).pop();
              },
              child: const Text('Done'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(child: Text('Error: ${e.toString()}')),
            ],
          ),
          backgroundColor: Colors.red[600],
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 4),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Widget _summaryRow(String label, String value, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: theme.colorScheme.onSurface.withOpacity(0.7),
              fontSize: 13,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 13,
              color: theme.colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Apply for Loan'),
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [

              // Loan Amount
              Text(
                'Loan Amount',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                ],
                validator: (v) {
                  if (v?.isEmpty ?? true) return 'Please enter loan amount';
                  final amount = double.tryParse(v!);
                  if (amount == null) return 'Invalid amount';
                  if (amount < 10000) return 'Minimum loan amount is ₦10,000';
                  if (amount > 5000000) return 'Maximum loan amount is ₦5,000,000';
                  return null;
                },
                decoration: InputDecoration(
                  hintText: 'e.g., 500000',
                  prefixIcon: const Icon(Icons.account_balance_wallet),
                  prefixText: '₦ ',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Min: ₦10,000 • Max: ₦5,000,000',
                style: TextStyle(
                  fontSize: 12,
                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                ),
              ),
              const SizedBox(height: 24),

              // Loan Term
              Text(
                'Repayment Period',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _termController,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: (v) {
                  if (v?.isEmpty ?? true) return 'Please enter loan term';
                  final term = int.tryParse(v!);
                  if (term == null) return 'Invalid term';
                  if (term < 1) return 'Minimum term is 1 month';
                  if (term > 60) return 'Maximum term is 60 months';
                  return null;
                },
                decoration: InputDecoration(
                  hintText: 'e.g., 12',
                  prefixIcon: const Icon(Icons.calendar_today),
                  suffixText: 'months',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Choose between 1 to 60 months',
                style: TextStyle(
                  fontSize: 12,
                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                ),
              ),
              const SizedBox(height: 24),

              // Loan Purpose
              Text(
                'Loan Purpose',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _selectedPurpose,
                isExpanded: true,
                decoration: InputDecoration(
                  hintText: 'Select Purpose',
                  prefixIcon: const Icon(Icons.label_outline),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (v) => v == null ? 'Please select a purpose' : null,
                items: _loanPurposes.map((purpose) {
                  return DropdownMenuItem(
                    value: purpose,
                    child: Text(purpose),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() => _selectedPurpose = value);
                },
              ),
              if (_selectedPurpose == 'Other') ...[
                const SizedBox(height: 16),
                TextFormField(
                  controller: _purposeController,
                  maxLines: 3,
                  validator: (v) => v?.isEmpty ?? true ? 'Please specify purpose' : null,
                  decoration: InputDecoration(
                    labelText: 'Specify Purpose',
                    hintText: 'Tell us more about your loan purpose...',
                    alignLabelWithHint: true,
                    prefixIcon: const Icon(Icons.description),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // Loan Summary
              if (_monthlyPayment > 0) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: theme.colorScheme.outline.withOpacity(0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Loan Summary',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _buildSummaryRow('Interest Rate', '$_interestRate% per annum', theme),
                      const SizedBox(height: 8),
                      _buildSummaryRow('Estimated Interest', '₦${_estimatedInterest.toStringAsFixed(2)}', theme),
                      const SizedBox(height: 8),
                      _buildSummaryRow('Total Payment', '₦${_totalAmount.toStringAsFixed(2)}', theme, highlight: true),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _applyForLoan,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Submit Application',
                          style: TextStyle(
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

  Widget _buildSummaryRow(String label, String value, ThemeData theme, {bool highlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: highlight ? 15 : 14,
            color: highlight ? theme.colorScheme.onSurface : theme.colorScheme.onSurface.withOpacity(0.7),
            fontWeight: highlight ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: highlight ? 16 : 14,
            fontWeight: FontWeight.w600,
            color: theme.colorScheme.onSurface,
          ),
        ),
      ],
    );
  }
}