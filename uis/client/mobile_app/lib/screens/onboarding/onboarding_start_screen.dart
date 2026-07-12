import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/language_switcher_button.dart';

class OnboardingStartScreen extends StatelessWidget {
  const OnboardingStartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context)!;
    
    // Mark that user has seen onboarding screen
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthProvider>().markOnboardingSeen();
    });
    
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        final tenant = tenantProvider.tenantConfig;
        final primaryColor = tenantProvider.primaryColor;
        
        return Scaffold(
          body: Stack(
            children: [
              // Language switcher
              Positioned(
                top: 40,
                right: 16,
                child: SafeArea(
                  child: LanguageSwitcherButton(
                    isDark: Theme.of(context).brightness == Brightness.dark,
                  ),
                ),
              ),
              SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 40),
                  // Logo (matching web app)
                  Center(
                    child: Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: primaryColor,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: primaryColor.withOpacity(0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Center(
                        child: tenant.logo.isNotEmpty
                            ? Image.network(
                                tenant.logo,
                                width: 80,
                                height: 80,
                                fit: BoxFit.contain,
                                errorBuilder: (context, error, stackTrace) {
                                  return Text(
                                    tenant.name.substring(0, 2).toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 42,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  );
                                },
                              )
                            : Text(
                                tenant.name.substring(0, 2).toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 42,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 40),
                  // Title (matching web app)
                  Text(
                    'Welcome to ${tenantProvider.appName}',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.onSurface,
                    ),
                    textAlign: TextAlign.center,
                  ),
              const SizedBox(height: 16),
              Text(
                'Complete your account setup to unlock all features and ensure CBN compliance.',
                style: TextStyle(
                  fontSize: 16,
                  color: theme.colorScheme.onSurface.withOpacity(0.7),
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              // Steps overview
              _buildStepCard(context, theme, '1', 'Account Type', 'Select Individual or Business', required: true),
              const SizedBox(height: 12),
              _buildStepCard(context, theme, '2', 'Enter BVN', 'Provide your Bank Verification Number', required: false),
              const SizedBox(height: 12),
              _buildStepCard(context, theme, '3', 'Address Details', 'Provide your address information', required: false),
              const SizedBox(height: 12),
              _buildStepCard(context, theme, '4', 'Create PIN', 'Secure your account', required: true),
              const SizedBox(height: 48),
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pushReplacementNamed(context, '/onboarding-account-type');
                  },
                  style: ElevatedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(l10n.startOnboarding),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  Navigator.pushReplacementNamed(context, '/login');
                },
                child: Text(l10n.alreadyHaveAccountLogin),
              ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStepCard(BuildContext context, ThemeData theme, String number, String title, String subtitle, {required bool required}) {
    final cardColor = required 
        ? theme.colorScheme.primaryContainer 
        : theme.colorScheme.surfaceContainerHighest;
    final borderColor = required 
        ? theme.colorScheme.primary.withOpacity(0.5)
        : theme.colorScheme.outline.withOpacity(0.3);
    final numberBgColor = required 
        ? theme.colorScheme.primary 
        : theme.colorScheme.onSurfaceVariant;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor,
          width: required ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: numberBgColor,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                    ),
                    if (!required)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.orange[100],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Optional',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).brightness == Brightness.dark 
                                ? Colors.orange[200] 
                                : Colors.orange[900],
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 13,
                    color: theme.colorScheme.onSurface.withOpacity(0.7),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
