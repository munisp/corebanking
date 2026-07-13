
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter/services.dart';
import '../../../models/insurance_policy.dart';
import '../../../services/insurance_service.dart';
import '../../../services/error_handler_service.dart';
import '../../../services/payment_service.dart';
import '../../../services/api_service.dart';
import '../../../config/app_theme.dart';
import 'apply_policy_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:universal_html/html.dart' as html;
import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;


class InsurancePoliciesScreen extends StatefulWidget {
  const InsurancePoliciesScreen({super.key});

  @override
  State<InsurancePoliciesScreen> createState() => _InsurancePoliciesScreenState();
}

class _InsurancePoliciesScreenState extends State<InsurancePoliciesScreen> {
  final InsuranceService _insuranceService = InsuranceService();
  final PaymentService _paymentService = PaymentService(ApiService());
  
  bool _isLoading = true;
  String? _errorMessage;
  List<InsurancePolicy> _policies = [];

  @override
  void initState() {
    super.initState();
    _loadPolicies();
  }

  Future<void> _loadPolicies() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final policies = await _insuranceService.getCustomerPolicies();
      setState(() {
        _policies = policies;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = ErrorHandlerService.handleError(e);
        _isLoading = false;
      });
    }
  }

    /// Get account_number from SharedPreferences (mobile) or localStorage (web)
  Future<String?> _getAccountNumberFromStorage() async {
    String? accountNumber;
    // Only mobile logic for now
    try {
      final prefs = await SharedPreferences.getInstance();
      final accountJson = prefs.getString('account');
      print('Retrieved account JSON: $accountJson');
      if (kIsWeb) {
        try {
          final accountJson = html.window.localStorage['account'];
          if (accountJson != null && accountJson.isNotEmpty) {
            final accountData = jsonDecode(accountJson);
            accountNumber = accountData['id']?.toString();
          }
        } catch (_) {
          // Skip if fails
        }
      } else {
        try {
          final prefs = await SharedPreferences.getInstance();
          final accountJson = prefs.getString('account');
          if (accountJson != null && accountJson.isNotEmpty) {
            final accountData = jsonDecode(accountJson);
            accountNumber = accountData['account_number']?.toString();
          }
        } catch (_) {
          // Skip if fails
        }
      }
    } catch (_) {}
    return accountNumber;
  }

  String _formatDate(DateTime date) {
    return DateFormat('MMM dd, yyyy').format(date);
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'expired':
        return Colors.red;
      case 'cancelled':
        return Colors.grey;
      default:
        return Colors.blue;
    }
  }

  IconData _getPolicyIcon(String policyType) {
    switch (policyType.toLowerCase()) {
      case 'health':
        return Icons.local_hospital;
      case 'life':
        return Icons.favorite;
      case 'auto':
        return Icons.directions_car;
      case 'travel':
        return Icons.flight;
      default:
        return Icons.description;
    }
  }

  void _showPolicyDetails(InsurancePolicy policy) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_insuranceService.getPolicyTypeDisplayName(policy.policyType)),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDetailRow('Policy ID', policy.id),
              _buildDetailRow('Coverage Amount', '₦${NumberFormat('#,###').format(policy.coverageAmount)}'),
              _buildDetailRow('Premium', '₦${NumberFormat('#,###').format(policy.premium)}'),
              _buildDetailRow('Duration', '${policy.durationMonths} months'),
              _buildDetailRow('Status', policy.status.toUpperCase()),
              _buildDetailRow('Start Date', _formatDate(policy.startDate)),
              _buildDetailRow('Expiry Date', _formatDate(policy.expiryDate)),
              if (policy.nextPaymentDate != null)
                _buildDetailRow('Next Payment', _formatDate(policy.nextPaymentDate!)),
              if (policy.beneficiaries.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Beneficiaries:',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                ...policy.beneficiaries.map(
                  (b) => Padding(
                    padding: const EdgeInsets.only(left: 8, bottom: 4),
                    child: Text('• $b'),
                  ),
                ),
              ],
              if (policy.additionalInfo != null && policy.additionalInfo!.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Additional Information:',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                ...policy.additionalInfo!.entries.map(
                  (e) => Padding(
                    padding: const EdgeInsets.only(left: 8, bottom: 4),
                    child: Text('${e.key}: ${e.value}'),
                  ),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey[700],
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
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
                      _buildDetailRow('Policy Type', policy.policyType.toUpperCase()),
                      _buildDetailRow('Coverage', '₦${NumberFormat('#,###').format(policy.coverageAmount)}'),
                      _buildDetailRow('Premium Amount', '₦${NumberFormat('#,###').format(policy.premium)}'),
                      _buildDetailRow('Duration', '${policy.durationMonths} months'),
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
                  final payerAccountNumber = await _getAccountNumberFromStorage();
                  if (payerAccountNumber == null || payerAccountNumber.isEmpty) {
                    setDialogState(() => isProcessing = false);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Could not retrieve your account number. Please refresh your account from the dashboard or re-login.'),
                        backgroundColor: Colors.red,
                      ),
                    );
                    return;
                  }
                  final paymentResult = await _paymentService.insurancePremiumPayment(
                    insurancePolicyId: policy.id,
                    payer: payerAccountNumber,
                    pin: pinController.text,
                  );
                  if (paymentResult['success'] != true) {
                    throw Exception(paymentResult['message'] ?? 'Payment failed');
                  }
                  pinController.dispose();
                  Navigator.pop(dialogContext);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Premium payment successful! Your policy will be activated by admin.'),
                      backgroundColor: Colors.green,
                      duration: Duration(seconds: 4),
                    ),
                  );
                  _loadPolicies();
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

  Widget _buildInfoColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 60, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.red),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadPolicies,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _policies.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.policy, size: 80, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text(
                            'No insurance policies yet',
                            style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Apply for a policy to get started',
                            style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton.icon(
                            onPressed: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const ApplyPolicyScreen(),
                                ),
                              );
                              _loadPolicies();
                            },
                            icon: const Icon(Icons.add),
                            label: const Text('Apply for Policy'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadPolicies,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _policies.length,
                        itemBuilder: (context, index) {
                          final policy = _policies[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            elevation: 2,
                            child: InkWell(
                              onTap: () => _showPolicyDetails(policy),
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                                          child: Icon(
                                            _getPolicyIcon(policy.policyType),
                                            color: AppTheme.primaryColor,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                _insuranceService.getPolicyTypeDisplayName(policy.policyType),
                                                style: const TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                              Text(
                                                'ID: ${policy.id}',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey[600],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: _getStatusColor(policy.status).withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(
                                              color: _getStatusColor(policy.status),
                                              width: 1,
                                            ),
                                          ),
                                          child: Text(
                                            policy.status.toUpperCase(),
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              color: _getStatusColor(policy.status),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: _buildInfoColumn(
                                            'Coverage',
                                            '₦${NumberFormat('#,###').format(policy.coverageAmount)}',
                                          ),
                                        ),
                                        Expanded(
                                          child: _buildInfoColumn(
                                            'Premium',
                                            '₦${NumberFormat('#,###').format(policy.premium)}',
                                          ),
                                        ),
                                        Expanded(
                                          child: _buildInfoColumn(
                                            'Duration',
                                            '${policy.durationMonths} mo',
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Expires: ${_formatDate(policy.expiryDate)}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey[600],
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (policy.status.toLowerCase() == 'draft' || policy.status.toLowerCase() == 'pending') ...[
                                      const SizedBox(height: 8),
                                      SizedBox(
                                        width: double.infinity,
                                        child: ElevatedButton.icon(
                                          icon: const Icon(Icons.payment),
                                          label: const Text('Pay Premium'),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: AppTheme.primaryColor,
                                            foregroundColor: Colors.white,
                                          ),
                                          onPressed: () => _showPaymentDialog(policy),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
      floatingActionButton: _policies.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const ApplyPolicyScreen(),
                  ),
                );
                _loadPolicies();
              },
              icon: const Icon(Icons.add),
              label: const Text('Apply'),
            )
          : null,
    );
  }
}
