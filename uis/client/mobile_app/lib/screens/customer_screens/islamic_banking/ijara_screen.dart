import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import '../../../services/islamic_banking_service.dart';
import '../../../services/api_service.dart';
import '../../../models/islamic_banking_product.dart';

class IjaraScreen extends StatefulWidget {
  const IjaraScreen({super.key});

  @override
  State<IjaraScreen> createState() => _IjaraScreenState();
}

class _IjaraScreenState extends State<IjaraScreen> {
  late IslamicBankingService _islamicBankingService;
  List<IjaraProduct> _products = [];
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
      final products = await _islamicBankingService.getAllIjara();
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
      builder: (context) => _IjaraApplicationForm(
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
          'Ijara - Islamic Leasing',
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
                          'Error loading leases',
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
                              Icons.key_outlined,
                              size: 80,
                              color: AppTheme.getTextSecondary(context).withValues(alpha: 0.3),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No Ijara Leases',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.getTextPrimary(context),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Start by applying for Islamic leasing',
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
                                          product.assetName,
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
                                          label: 'Asset Value',
                                          value: currencyFormat.format(product.assetValue),
                                        ),
                                      ),
                                      Expanded(
                                        child: _InfoItem(
                                          label: 'Monthly Rental',
                                          value: currencyFormat.format(product.monthlyRental),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: _InfoItem(
                                          label: 'Lease Type',
                                          value: product.leaseType.toUpperCase(),
                                        ),
                                      ),
                                      Expanded(
                                        child: _InfoItem(
                                          label: 'Tenure',
                                          value: '${product.tenureMonths} months',
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (product.leaseStartDate != null && product.leaseEndDate != null) ...[
                                    const SizedBox(height: 12),
                                    _InfoItem(
                                      label: 'Lease Period',
                                      value: '${DateFormat('MMM dd, yyyy').format(product.leaseStartDate!)} - ${DateFormat('MMM dd, yyyy').format(product.leaseEndDate!)}',
                                    ),
                                  ],
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

class _IjaraApplicationForm extends StatefulWidget {
  final VoidCallback onSubmit;

  const _IjaraApplicationForm({required this.onSubmit});

  @override
  State<_IjaraApplicationForm> createState() => _IjaraApplicationFormState();
}

class _IjaraApplicationFormState extends State<_IjaraApplicationForm> {
  final _formKey = GlobalKey<FormState>();
  final _assetNameController = TextEditingController();
  final _assetValueController = TextEditingController();
  final _tenureController = TextEditingController();
  String _leaseType = 'operating';
  bool _isSubmitting = false;

  @override
  void dispose() {
    _assetNameController.dispose();
    _assetValueController.dispose();
    _tenureController.dispose();
    super.dispose();
  }

  Future<void> _submitApplication() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final service = IslamicBankingService(ApiService());
      await service.applyForIjara(
        assetName: _assetNameController.text,
        assetValue: double.parse(_assetValueController.text),
        tenureMonths: int.parse(_tenureController.text),
        leaseType: _leaseType,
      );

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ijara application submitted successfully'),
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
                        'Apply for Ijara',
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
                TextFormField(
                  controller: _assetNameController,
                  decoration: const InputDecoration(
                    labelText: 'Asset Name',
                    hintText: 'e.g., Office Equipment, Vehicle',
                    prefixIcon: Icon(Icons.label_outline),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter asset name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _assetValueController,
                  decoration: const InputDecoration(
                    labelText: 'Asset Value (₦)',
                    hintText: '0.00',
                    prefixIcon: Icon(Icons.attach_money),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter asset value';
                    }
                    if (double.tryParse(value) == null) {
                      return 'Please enter a valid number';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _tenureController,
                  decoration: const InputDecoration(
                    labelText: 'Lease Tenure (months)',
                    hintText: 'e.g., 12, 24, 36',
                    prefixIcon: Icon(Icons.calendar_month),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter tenure';
                    }
                    final number = int.tryParse(value);
                    if (number == null || number <= 0) {
                      return 'Please enter a valid number of months';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _leaseType,
                  decoration: const InputDecoration(
                    labelText: 'Lease Type',
                    prefixIcon: Icon(Icons.category_outlined),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'operating', child: Text('Operating Lease')),
                    DropdownMenuItem(value: 'finance', child: Text('Finance Lease')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _leaseType = value);
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
