import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import '../../../services/local_storage_service.dart';

class BusinessDetailsScreen extends StatefulWidget {
  const BusinessDetailsScreen({super.key});

  @override
  State<BusinessDetailsScreen> createState() => _BusinessDetailsScreenState();
}

class _BusinessDetailsScreenState extends State<BusinessDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _businessNameController = TextEditingController();
  final _tinController = TextEditingController();
  final _cacController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _businessNameController.dispose();
    _tinController.dispose();
    _cacController.dispose();
    super.dispose();
  }

  Future<void> _handleContinue() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _isLoading = true);

    await LocalStorageService.setString('onboarding_business_name', _businessNameController.text.trim());
    await LocalStorageService.setString('onboarding_tin', _tinController.text.trim());
    await LocalStorageService.setString('onboarding_cac', _cacController.text.trim());

    setState(() => _isLoading = false);

    if (mounted) {
      Navigator.pushNamed(
        context,
        '/onboarding-address',
        arguments: {'accountType': 'business'},
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenantProvider = context.watch<TenantProvider>();
    final primaryColor = tenantProvider.primaryColor;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pushReplacementNamed(context, '/onboarding-account-type'),
        ),
        title: const Text('Business Details'),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                Text(
                  'Business Details',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.getTextPrimary(context),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Provide your business registration information',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.getTextSecondary(context),
                  ),
                ),
                const SizedBox(height: 32),

                // Business Name
                TextFormField(
                  controller: _businessNameController,
                  decoration: InputDecoration(
                    labelText: 'Business Name',
                    hintText: 'Registered business name',
                    prefixIcon: const Icon(Icons.business_outlined),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  textInputAction: TextInputAction.next,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Business name is required' : null,
                ),
                const SizedBox(height: 16),

                // TIN
                TextFormField(
                  controller: _tinController,
                  decoration: InputDecoration(
                    labelText: 'Tax Identification Number (TIN)',
                    hintText: 'e.g. 1234567-0001',
                    prefixIcon: const Icon(Icons.tag_outlined),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  textInputAction: TextInputAction.next,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'TIN is required' : null,
                ),
                const SizedBox(height: 16),

                // CAC Registration Number
                TextFormField(
                  controller: _cacController,
                  decoration: InputDecoration(
                    labelText: 'CAC Registration Number',
                    hintText: 'e.g. RC-1234567',
                    prefixIcon: const Icon(Icons.numbers_outlined),
                    helperText: 'As shown on your CAC certificate',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _handleContinue(),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'CAC registration number is required' : null,
                ),
                const SizedBox(height: 32),

                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleContinue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text(
                            'Continue',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
