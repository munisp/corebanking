import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../../models/insurance_policy.dart';
import '../../../services/insurance_service.dart';
import '../../../services/error_handler_service.dart';
import '../../../config/app_theme.dart';

class SubmitClaimScreen extends StatefulWidget {
  const SubmitClaimScreen({super.key});

  @override
  State<SubmitClaimScreen> createState() => _SubmitClaimScreenState();
}

class _SubmitClaimScreenState extends State<SubmitClaimScreen> {
  final _formKey = GlobalKey<FormState>();
  final InsuranceService _insuranceService = InsuranceService();

  bool _isSubmitting = false;
  bool _isLoadingPolicies = true;
  List<InsurancePolicy> _policies = [];

  String? _selectedPolicyId;
  final TextEditingController _amountController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  final TextEditingController _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPolicies();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadPolicies() async {
    try {
      final policies = await _insuranceService.getCustomerPolicies();
      setState(() {
        _policies =
            policies.where((p) => p.status.toLowerCase() == 'active').toList();
        _isLoadingPolicies = false;
        if (_policies.isNotEmpty) {
          _selectedPolicyId = _policies.first.id;
        }
      });
    } catch (e) {
      setState(() {
        _isLoadingPolicies = false;
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ErrorHandlerService.handleError(e)),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );

    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _submitClaim() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedPolicyId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a policy'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await _insuranceService.submitClaim(
        policyId: _selectedPolicyId!,
        claimAmount: double.parse(_amountController.text),
        incidentDate: _selectedDate,
        incidentDescription: _descriptionController.text.trim(),
        supportingDocuments: [],
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Claim submitted successfully!'),
          backgroundColor: Colors.green,
        ),
      );

      Navigator.pop(context);
    } catch (e) {
      setState(() => _isSubmitting = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ErrorHandlerService.handleError(e)),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  String _formatDate(DateTime date) {
    return DateFormat('MMM dd, yyyy').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Submit Claim'),
      ),
      body: _isLoadingPolicies
          ? const Center(child: CircularProgressIndicator())
          : _policies.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.policy, size: 80, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'No active policies',
                        style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'You need an active policy to submit a claim',
                        style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Go Back'),
                      ),
                    ],
                  ),
                )
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      const Text(
                        'Select Policy',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Policy selection dropdown
                      DropdownButtonFormField<String>(
                        initialValue: _selectedPolicyId,
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.policy),
                        ),

                        // 🔑 This controls how the selected item is shown (closed state)
                        selectedItemBuilder: (context) {
                          return _policies.map((policy) {
                            return Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                _insuranceService.getPolicyTypeDisplayName(
                                    policy.policyType),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList();
                        },

                        items: _policies.map((policy) {
                          return DropdownMenuItem<String>(
                            value: policy.id,
                            child: ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                _insuranceService.getPolicyTypeDisplayName(
                                    policy.policyType),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              subtitle: Text(
                                'ID: ${policy.id}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ),
                          );
                        }).toList(),

                        onChanged: (value) {
                          setState(() {
                            _selectedPolicyId = value;
                          });
                        },

                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please select a policy';
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 14),

                      // Claim amount
                      TextFormField(
                        controller: _amountController,
                        decoration: const InputDecoration(
                          labelText: 'Claim Amount (₦)',
                          hintText: 'e.g., 10000',
                          prefixIcon: Icon(Icons.money),
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter claim amount';
                          }
                          final amount = double.tryParse(value);
                          if (amount == null || amount <= 0) {
                            return 'Please enter a valid amount';
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 16),

                      // Incident date
                      InkWell(
                        onTap: _selectDate,
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Incident Date',
                            prefixIcon: Icon(Icons.calendar_today),
                            border: OutlineInputBorder(),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(_formatDate(_selectedDate)),
                              const Icon(Icons.arrow_drop_down),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Incident description
                      TextFormField(
                        controller: _descriptionController,
                        decoration: const InputDecoration(
                          labelText: 'Incident Description',
                          hintText: 'Describe what happened...',
                          prefixIcon: Icon(Icons.description),
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 5,
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Please provide incident description';
                          }
                          if (value.trim().length < 10) {
                            return 'Description must be at least 10 characters';
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 24),

                      // Info box
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border:
                              Border.all(color: Colors.blue.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline, color: Colors.blue[700]),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Your claim will be reviewed within 3-5 business days. You will be notified of the status via email.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.blue[900],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Submit button
                      SizedBox(
                        height: 50,
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : _submitClaim,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryColor,
                            foregroundColor: Colors.white,
                          ),
                          child: _isSubmitting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                        Colors.white),
                                  ),
                                )
                              : const Text(
                                  'Submit Claim',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
