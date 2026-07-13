import 'package:flutter/material.dart';
import '../../../services/local_storage_service.dart';
import '../../../providers/tenant_provider.dart';
import 'package:provider/provider.dart';

class AccountTypeScreen extends StatefulWidget {
  const AccountTypeScreen({super.key});

  @override
  State<AccountTypeScreen> createState() => _AccountTypeScreenState();
}

class _AccountTypeScreenState extends State<AccountTypeScreen> {
  String? _selectedType;

  @override
  Widget build(BuildContext context) {
    final tenantProvider = context.watch<TenantProvider>();
    final primaryColor = tenantProvider.primaryColor;
    
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pushReplacementNamed(context, '/onboarding-start'),
        ),
        title: const Text('Select Account Type'),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              // Header (matching web app)
              Text(
                'Select Account Type',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).textTheme.headlineMedium?.color,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Choose the type of account that best fits your needs',
                style: TextStyle(
                  fontSize: 15,
                  color: Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7),
                ),
              ),
              const SizedBox(height: 32),

              // Individual Account (matching web app)
              _buildAccountTypeCard(
                context: context,
                type: 'individual',
                title: 'Individual Account',
                subtitle: 'For personal banking needs',
                icon: Icons.person_outline,
                features: [
                  'Personal savings and transactions',
                  'Bill payments and transfers',
                  'Loan applications up to ₦5M',
                ],
                primaryColor: primaryColor,
              ),
              const SizedBox(height: 16),

              // Business Account (matching web app)
              _buildAccountTypeCard(
                context: context,
                type: 'business',
                title: 'Business Account',
                subtitle: 'For companies and organizations',
                icon: Icons.business_outlined,
                features: [
                  'Business banking and payroll',
                  'LPO financing and invoicing',
                  'Higher transaction limits',
                ],
                primaryColor: primaryColor,
              ),
              const SizedBox(height: 32),

              // Continue Button (matching web app)
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: _selectedType == null
                      ? null
                      : () async {
                          if (_selectedType != null) {
                            // Store account type (matching web app)
                            await LocalStorageService.setString('onboarding_account_type', _selectedType!);
                            
                            if (!mounted) return;
                            
                            // Route business accounts to business details, others to BVN verification
                            if (_selectedType == 'business') {
                              Navigator.pushReplacementNamed(
                                context,
                                '/business-details',
                              );
                            } else {
                              Navigator.pushReplacementNamed(
                                context,
                                '/bvn-verification',
                                arguments: {
                                  'accountType': _selectedType,
                                },
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.grey[300],
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Continue',
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
      ),
    );
  }

  Widget _buildAccountTypeCard({
    required BuildContext context,
    required String type,
    required String title,
    required String subtitle,
    required IconData icon,
    required List<String> features,
    required Color primaryColor,
  }) {
    final isSelected = _selectedType == type;
    
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedType = type;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isSelected 
              ? primaryColor.withOpacity(0.1) 
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected 
                ? primaryColor 
                : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected 
                    ? primaryColor.withOpacity(0.2) 
                    : Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                size: 28,
                color: isSelected 
                    ? primaryColor 
                    : Colors.grey[600],
              ),
            ),
            const SizedBox(width: 16),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).textTheme.headlineMedium?.color,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 14,
                      color: Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Features list
                  ...features.map((feature) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '• ',
                          style: TextStyle(
                            fontSize: 14,
                            color: Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            feature,
                            style: TextStyle(
                              fontSize: 14,
                              color: Theme.of(context).textTheme.bodyMedium?.color?.withOpacity(0.7),
                            ),
                          ),
                        ),
                      ],
                    ),
                  )),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Check icon
            if (isSelected)
              Icon(
                Icons.check_circle,
                color: primaryColor,
                size: 24,
              ),
          ],
        ),
      ),
    );
  }
}
