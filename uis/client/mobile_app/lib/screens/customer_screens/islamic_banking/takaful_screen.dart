import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import '../../../services/islamic_banking_service.dart';
import '../../../services/api_service.dart';
import '../../../models/islamic_banking_product.dart';

class TakafulScreen extends StatefulWidget {
  const TakafulScreen({super.key});

  @override
  State<TakafulScreen> createState() => _TakafulScreenState();
}

class _TakafulScreenState extends State<TakafulScreen> {
  late IslamicBankingService _islamicBankingService;
  List<TakafulProduct> _products = [];
  bool _isLoading = true;
  String? _errorMessage;
  final currencyFormat = NumberFormat.currency(symbol: '₦', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    _islamicBankingService = IslamicBankingService(ApiService());
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final products = await _islamicBankingService.getAllTakaful();
      setState(() {
        _products = products;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _showApplicationForm() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TakafulApplicationForm(
        onSubmit: _loadProducts,
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'active':
        return AppTheme.successColor;
      case 'pending':
        return AppTheme.warningColor;
      case 'completed':
        return AppTheme.primaryColor;
      case 'rejected':
      case 'cancelled':
        return AppTheme.errorColor;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Takaful - Islamic Insurance',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showApplicationForm,
        backgroundColor: tenantProvider.primaryColor,
        icon: const Icon(Icons.add),
        label: const Text('Apply Now'),
      ),
      body: RefreshIndicator(
        onRefresh: _loadProducts,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline, size: 64, color: AppTheme.errorColor),
                        const SizedBox(height: 16),
                        Text(
                          'Error loading policies',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.getTextPrimary(context),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 32),
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: AppTheme.getTextSecondary(context)),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: _loadProducts,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : _products.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.shield_outlined,
                              size: 80,
                              color: AppTheme.getTextSecondary(context).withValues(alpha: 0.3),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No Takaful Policies',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.getTextPrimary(context),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Start by applying for Takaful insurance',
                              style: TextStyle(color: AppTheme.getTextSecondary(context)),
                            ),
                            const SizedBox(height: 24),
                            ElevatedButton.icon(
                              onPressed: _showApplicationForm,
                              icon: const Icon(Icons.add),
                              label: const Text('Apply Now'),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _products.length,
                        itemBuilder: (context, index) {
                          final product = _products[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: AppTheme.getCardBackground(context),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: AppTheme.getBorderColor(context).withValues(alpha: 0.3),
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          product.policyName,
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: AppTheme.getTextPrimary(context),
                                          ),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 6,
                                        ),
                                        decoration: BoxDecoration(
                                          color: _getStatusColor(product.status).withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          product.status.toUpperCase(),
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: _getStatusColor(product.status),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    product.policyType.toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: tenantProvider.primaryColor,
                                    ),
                                  ),
                                  if (product.referenceNumber != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'Ref: ${product.referenceNumber}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: AppTheme.getTextSecondary(context),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 16),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: _InfoItem(
                                          label: 'Coverage Amount',
                                          value: currencyFormat.format(product.coverageAmount),
                                        ),
                                      ),
                                      Expanded(
                                        child: _InfoItem(
                                          label: 'Contribution',
                                          value: currencyFormat.format(product.contributionAmount),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: _InfoItem(
                                          label: 'Frequency',
                                          value: product.frequency.toUpperCase(),
                                        ),
                                      ),
                                      if (product.policyStartDate != null && product.policyEndDate != null)
                                        Expanded(
                                          child: _InfoItem(
                                            label: 'Policy End',
                                            value: DateFormat('MMM dd, yyyy').format(product.policyEndDate!),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  _InfoItem(
                                    label: 'Application Date',
                                    value: DateFormat('MMM dd, yyyy').format(product.applicationDate),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}

class _InfoItem extends StatelessWidget {
  final String label;
  final String value;

  const _InfoItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: AppTheme.getTextSecondary(context),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.getTextPrimary(context),
          ),
        ),
      ],
    );
  }
}

class _TakafulApplicationForm extends StatefulWidget {
  final VoidCallback onSubmit;

  const _TakafulApplicationForm({required this.onSubmit});

  @override
  State<_TakafulApplicationForm> createState() => _TakafulApplicationFormState();
}

class _TakafulApplicationFormState extends State<_TakafulApplicationForm> {
  final _formKey = GlobalKey<FormState>();
  final _policyNameController = TextEditingController();
  final _coverageAmountController = TextEditingController();
  String _policyType = 'family';
  String _frequency = 'monthly';
  bool _isSubmitting = false;

  @override
  void dispose() {
    _policyNameController.dispose();
    _coverageAmountController.dispose();
    super.dispose();
  }

  Future<void> _submitApplication() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final service = IslamicBankingService(ApiService());
      await service.applyForTakaful(
        policyType: _policyType,
        policyName: _policyNameController.text,
        coverageAmount: double.parse(_coverageAmountController.text),
        frequency: _frequency,
      );

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Takaful application submitted successfully'),
            backgroundColor: AppTheme.successColor,
          ),
        );
        widget.onSubmit();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = Provider.of<TenantProvider>(context);

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.getCardBackground(context),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Apply for Takaful',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.getTextPrimary(context),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                DropdownButtonFormField<String>(
                  initialValue: _policyType,
                  decoration: const InputDecoration(
                    labelText: 'Policy Type',
                    prefixIcon: Icon(Icons.category_outlined),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'family', child: Text('Family Takaful')),
                    DropdownMenuItem(value: 'general', child: Text('General Takaful')),
                    DropdownMenuItem(value: 'health', child: Text('Health Takaful')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _policyType = value);
                    }
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _policyNameController,
                  decoration: const InputDecoration(
                    labelText: 'Policy Name',
                    hintText: 'e.g., Family Protection Plan',
                    prefixIcon: Icon(Icons.label_outline),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter policy name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _coverageAmountController,
                  decoration: const InputDecoration(
                    labelText: 'Coverage Amount (₦)',
                    hintText: '0.00',
                    prefixIcon: Icon(Icons.shield_outlined),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter coverage amount';
                    }
                    if (double.tryParse(value) == null) {
                      return 'Please enter a valid number';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _frequency,
                  decoration: const InputDecoration(
                    labelText: 'Contribution Frequency',
                    prefixIcon: Icon(Icons.calendar_today_outlined),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                    DropdownMenuItem(value: 'quarterly', child: Text('Quarterly')),
                    DropdownMenuItem(value: 'annually', child: Text('Annually')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _frequency = value);
                    }
                  },
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitApplication,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: tenantProvider.primaryColor,
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
      ),
    );
  }
}
