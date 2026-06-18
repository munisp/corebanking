import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../../../models/etherisc_policy.dart';
import '../../../models/insurance_policy.dart';
import '../../../services/insurance_service.dart';
import '../../../services/payment_service.dart';
import '../../../services/api_service.dart';
import '../../../services/error_handler_service.dart';
import '../../../config/app_theme.dart';

class ApplyPolicyScreen extends StatefulWidget {
  final EtheriscPolicy? selectedTemplate;
  
  const ApplyPolicyScreen({super.key, this.selectedTemplate});

  @override
  State<ApplyPolicyScreen> createState() => _ApplyPolicyScreenState();
}

class _ApplyPolicyScreenState extends State<ApplyPolicyScreen> {
  final _formKey = GlobalKey<FormState>();
  final InsuranceService _insuranceService = InsuranceService();
  final PaymentService _paymentService = PaymentService(ApiService());
  
  bool _isSubmitting = false;
  
  String _selectedPolicyType = 'health';
  final TextEditingController _coverageController = TextEditingController();
  final TextEditingController _durationController = TextEditingController();
  final List<TextEditingController> _beneficiaryControllers = [];

  @override
  void initState() {
    super.initState();
    
    // Pre-fill form if template is provided
    if (widget.selectedTemplate != null) {
      final template = widget.selectedTemplate!;
      _selectedPolicyType = _mapInsuranceTypeToPolicy(template.insuranceType);
      _coverageController.text = template.coverageAmount.toInt().toString();
      _durationController.text = template.durationMonths.toString();
    }
  }

  final Map<String, IconData> _policyTypes = {
    'health': Icons.local_hospital,
    'life': Icons.favorite,
    'auto': Icons.directions_car,
    'travel': Icons.flight,
    'crop': Icons.agriculture,
    'flight': Icons.flight_takeoff,
  };

  final Map<String, String> _policyDescriptions = {
    'health': 'Comprehensive health coverage including medical expenses, hospitalization, and treatments',
    'life': 'Financial protection for your loved ones in case of unexpected events',
    'auto': 'Protection for your vehicle against accidents, theft, and damages',
    'travel': 'Coverage for medical emergencies, trip cancellations, and lost baggage during travel',
    'crop': 'Weather-based crop insurance protecting against rainfall and temperature extremes',
    'flight': 'Automatic compensation for flight delays and cancellations',
  };

  @override
  void dispose() {
    _coverageController.dispose();
    _durationController.dispose();
    for (var controller in _beneficiaryControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  String _mapInsuranceTypeToPolicy(String insuranceType) {
    switch (insuranceType.toLowerCase()) {
      case 'crop_weather':
        return 'crop';
      case 'flight_delay':
        return 'flight';
      case 'health':
        return 'health';
      case 'life':
        return 'life';
      case 'auto':
        return 'auto';
      case 'travel':
        return 'travel';
      default:
        return 'health';
    }
  }

  void _addBeneficiary() {
    setState(() {
      _beneficiaryControllers.add(TextEditingController());
    });
  }

  void _removeBeneficiary(int index) {
    setState(() {
      _beneficiaryControllers[index].dispose();
      _beneficiaryControllers.removeAt(index);
    });
  }

  Future<void> _submitApplication() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final beneficiaries = _beneficiaryControllers
          .where((c) => c.text.trim().isNotEmpty)
          .map((c) => c.text.trim())
          .toList();

      final policy = await _insuranceService.applyForPolicy(
        policyType: _selectedPolicyType,
        coverageAmount: double.parse(_coverageController.text),
        durationMonths: int.parse(_durationController.text),
        beneficiaries: beneficiaries,
        additionalInfo: {},
      );

      if (!mounted) return;
      
      setState(() => _isSubmitting = false);
      
      // Show success dialog with payment information
      _showApplicationSuccessDialog(policy);
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

  void _showApplicationSuccessDialog(dynamic policy) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: const Icon(
          Icons.check_circle_outline,
          color: Colors.green,
          size: 60,
        ),
        title: const Text('Application Submitted!'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your insurance policy application has been submitted successfully.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.orange.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.orange.shade700, size: 20),
                      const SizedBox(width: 8),
                      const Text(
                        'Next Steps',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '1. Your policy is in DRAFT status\n'
                    '2. Complete premium payment\n'
                    '3. Admin will activate your policy\n'
                    '4. You\'ll receive confirmation',
                    style: TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Would you like to proceed with payment now?',
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              Navigator.pop(context); // Close apply screen
            },
            child: const Text('Later'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              _showPaymentDialog(policy);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('Pay Now'),
          ),
        ],
      ),
    );
  }

  void _showPaymentDialog(InsurancePolicy policy) {
    final pinController = TextEditingController();
    bool isProcessing = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Premium Payment'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Payment Details',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _buildPaymentDetailRow('Policy Type', policy.policyType.toUpperCase()),
                      _buildPaymentDetailRow('Coverage', '₦${NumberFormat('#,###').format(policy.coverageAmount)}'),
                      _buildPaymentDetailRow('Premium Amount', '₦${NumberFormat('#,###').format(policy.premium)}'),
                      _buildPaymentDetailRow('Duration', '${policy.durationMonths} months'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: pinController,
                  decoration: const InputDecoration(
                    labelText: 'Enter PIN',
                    hintText: '****',
                    prefixIcon: Icon(Icons.lock),
                    border: OutlineInputBorder(),
                  ),
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Your account will be debited for the premium payment.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: isProcessing ? null : () {
                pinController.dispose();
                Navigator.pop(dialogContext);
                Navigator.pop(context); // Close apply screen
              },
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: isProcessing ? null : () async {
                if (pinController.text.isEmpty || pinController.text.length != 4) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Please enter a valid 4-digit PIN'),
                      backgroundColor: Colors.red,
                    ),
                  );
                  return;
                }

                setDialogState(() => isProcessing = true);

                try {
                  // Get account_id from SharedPreferences (with fallback)
                  String? accountId;
                  try {
                    final prefs = await SharedPreferences.getInstance();
                    accountId = prefs.getString('account_id');
                    if (accountId == null || accountId.isEmpty) {
                      final accountJson = prefs.getString('account');
                      if (accountJson != null && accountJson.isNotEmpty) {
                        final accountData = jsonDecode(accountJson);
                        accountId = accountData['id']?.toString();
                      }
                    }
                  } catch (_) {}

                  if (accountId == null || accountId.isEmpty) {
                    throw Exception('Could not retrieve your account ID. Please refresh your account from the dashboard or re-login.');
                  }

                  // Call insurance premium payment API
                  final paymentResult = await _paymentService.insurancePremiumPayment(
                    insurancePolicyId: policy.id,
                    payer: accountId,
                    pin: pinController.text,
                  );
                  if (paymentResult['success'] != true) {
                    throw Exception(paymentResult['message'] ?? 'Payment failed');
                  }
                  pinController.dispose();
                  Navigator.pop(dialogContext); // Close payment dialog
                  // Show success message
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Premium payment successful! Your policy will be activated by admin.'),
                      backgroundColor: Colors.green,
                      duration: Duration(seconds: 4),
                    ),
                  );
                  Navigator.pop(context); // Close apply screen
                } catch (e) {
                  setDialogState(() => isProcessing = false);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(ErrorHandlerService.handleError(e)),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                foregroundColor: Colors.white,
              ),
              child: isProcessing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Text('Confirm Payment'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasTemplate = widget.selectedTemplate != null;
    
    return Scaffold(
      appBar: AppBar(
        title: Text(hasTemplate ? 'Apply for ${widget.selectedTemplate!.displayName}' : 'Apply for Insurance'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (hasTemplate) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppTheme.primaryColor.withOpacity(0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: AppTheme.primaryColor,
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'This form is pre-filled from the selected template. You can modify the values as needed.',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey[700],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
            
            const Text(
              'Select Policy Type',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            
            // Policy type selection
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _policyTypes.entries.map((entry) {
                final isSelected = _selectedPolicyType == entry.key;
                final isDisabled = hasTemplate; // Disable if template is selected
                
                return ChoiceChip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        entry.value,
                        size: 18,
                        color: isSelected 
                            ? Colors.white 
                            : isDisabled 
                                ? Colors.grey 
                                : AppTheme.primaryColor,
                      ),
                      const SizedBox(width: 8),
                      Text(entry.key.toUpperCase()),
                    ],
                  ),
                  selected: isSelected,
                  onSelected: isDisabled ? null : (selected) {
                    setState(() {
                      _selectedPolicyType = entry.key;
                    });
                  },
                  selectedColor: AppTheme.primaryColor,
                  backgroundColor: isDisabled 
                      ? Colors.grey[200] 
                      : AppTheme.primaryColor.withOpacity(0.1),
                  labelStyle: TextStyle(
                    color: isSelected 
                        ? Colors.white 
                        : isDisabled 
                            ? Colors.grey 
                            : AppTheme.primaryColor,
                    fontWeight: FontWeight.bold,
                  ),
                );
              }).toList(),
            ),
            
            const SizedBox(height: 16),
            
            // Policy description
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.05),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppTheme.primaryColor.withOpacity(0.2),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: AppTheme.primaryColor,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _policyDescriptions[_selectedPolicyType]!,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey[700],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Coverage Amount
            TextFormField(
              controller: _coverageController,
              decoration: const InputDecoration(
                labelText: 'Coverage Amount (₦)',
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
                  return 'Please enter coverage amount';
                }
                final amount = double.tryParse(value);
                if (amount == null || amount <= 0) {
                  return 'Please enter a valid amount';
                }
                return null;
              },
            ),
            
            const SizedBox(height: 16),
            
            // Duration
            TextFormField(
              controller: _durationController,
              decoration: const InputDecoration(
                labelText: 'Duration (Months)',
                hintText: 'e.g., 24',
                prefixIcon: Icon(Icons.calendar_month),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
              ],
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter duration';
                }
                final duration = int.tryParse(value);
                if (duration == null || duration <= 0) {
                  return 'Please enter a valid duration';
                }
                if (duration > 360) {
                  return 'Maximum duration is 360 months';
                }
                return null;
              },
            ),
            
            const SizedBox(height: 24),
            
            // Beneficiaries section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Beneficiaries (Optional)',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                TextButton.icon(
                  onPressed: _addBeneficiary,
                  icon: const Icon(Icons.add),
                  label: const Text('Add'),
                ),
              ],
            ),
            
            const SizedBox(height: 8),
            
            // Beneficiaries list
            ..._beneficiaryControllers.asMap().entries.map((entry) {
              final index = entry.key;
              final controller = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextFormField(
                  controller: controller,
                  decoration: InputDecoration(
                    labelText: 'Beneficiary ${index + 1}',
                    hintText: 'Full name',
                    prefixIcon: const Icon(Icons.person),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                      onPressed: () => _removeBeneficiary(index),
                    ),
                    border: const OutlineInputBorder(),
                  ),
                ),
              );
            }),
            
            const SizedBox(height: 24),
            
            // Submit button
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitApplication,
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
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text(
                        'Submit Application',
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
