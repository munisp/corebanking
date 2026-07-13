import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/registration_data.dart';
import '../../providers/theme_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../widgets/language_switcher_button.dart';
import '../../widgets/registration_progress_indicator.dart';
import '../../widgets/animated_background.dart';
import '../../widgets/premium_animations.dart';
import '../../widgets/premium_widgets.dart';
import '../../l10n/app_localizations.dart';
import '../../utils/text_case_utils.dart';

class RegisterStep1Screen extends StatefulWidget {
  final RegistrationData? initialData;

  const RegisterStep1Screen({
    super.key,
    this.initialData,
  });

  @override
  State<RegisterStep1Screen> createState() => _RegisterStep1ScreenState();
}

class _RegisterStep1ScreenState extends State<RegisterStep1Screen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _businessNameController;
  late TextEditingController _emailController;

  @override
  void initState() {
    super.initState();
    _firstNameController = TextEditingController(
      text: widget.initialData?.firstName ?? '',
    );
    _lastNameController = TextEditingController(
      text: widget.initialData?.lastName ?? '',
    );
      _businessNameController = TextEditingController(
        text: widget.initialData?.businessName ?? '',
      );
    _emailController = TextEditingController(
      text: widget.initialData?.email ?? '',
    );
  }

  void _handleNext() {
  if (_formKey.currentState?.validate() ?? false) {
    final businessName = _businessNameController.text.trim();
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();

    final registrationData = businessName.isNotEmpty
        ? (widget.initialData ?? RegistrationData()).copyWith(
            firstName: 'BUS_$businessName',
            lastName: '$firstName $lastName'.trim(),
            businessName: businessName,
            email: _emailController.text.trim(),
          )
        : (widget.initialData ?? RegistrationData()).copyWith(
            firstName: firstName,
            lastName: lastName,
            businessName: '',
            email: _emailController.text.trim(),
          );
    print('Registration Data: $registrationData.toString()');

     
     

    Navigator.pushNamed(
      context,
      '/register-step2',
      arguments: registrationData,
    );
  }
}

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final themeProvider = context.watch<ThemeProvider>();
    final tenantProvider = context.watch<TenantProvider>();
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(l10n.createAccount),
        elevation: 0,
        backgroundColor: Colors.transparent,
        actions: [
          LanguageSwitcherButton(
            isDark: themeProvider.isDarkMode,
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: Icon(
              themeProvider.isDarkMode ? Icons.light_mode : Icons.dark_mode,
            ),
            onPressed: () {
              themeProvider.toggleTheme();
            },
          ),
        ],
      ),
      body: AnimatedBackground(
        primaryColor: tenantProvider.primaryColor,
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 8),
                  ScaleInAnimation(
                    duration: const Duration(milliseconds: 600),
                    child: Center(
                      child: Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              tenantProvider.primaryColor,
                              Color.lerp(tenantProvider.primaryColor, Colors.purple, 0.3)!,
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: tenantProvider.primaryColor.withOpacity(0.4),
                              blurRadius: 24,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(24),
                          child: Image.asset(
                            'assets/icons/bp.png',
                            width: 90,
                            height: 90,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              if (tenantProvider.tenantConfig.logo.isNotEmpty) {
                                return Image.network(
                                  tenantProvider.tenantConfig.logo,
                                  width: 90,
                                  height: 90,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) {
                                    return Center(
                                      child: Text(
                                        toUpperCase(tenantProvider.tenantConfig.name.substring(0, 2)),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 36,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    );
                                  },
                                );
                              }
                              return Center(
                                child: Text(
                                  toUpperCase(tenantProvider.tenantConfig.name.substring(0, 2)),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 36,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 200),
                    child: Text(
                      l10n.welcomeTo(tenantProvider.appName),
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                        letterSpacing: -0.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 8),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 300),
                    child: Text(
                      l10n.createAccountInSteps,
                      style: TextStyle(
                        fontSize: 15,
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 32),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 400),
                    child: RegistrationProgressIndicator(
                      currentStep: 1,
                      totalSteps: 3,
                      stepLabels: [l10n.stepPersonal, l10n.stepContact, l10n.stepSecurity],
                    ),
                  ),
                  const SizedBox(height: 32),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 500),
                    slideOffset: const Offset(0, 0.05),
                    child: PremiumTextField(
                      controller: _firstNameController,
                      labelText: l10n.firstName,
                      hintText: l10n.enterFirstName,
                      prefixIcon: Icons.person_outlined,
                      keyboardType: TextInputType.name,
                      textInputAction: TextInputAction.next,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return l10n.pleaseEnterFirstName;
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(height: 20),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 600),
                    slideOffset: const Offset(0, 0.05),
                    child: PremiumTextField(
                      controller: _lastNameController,
                      labelText: l10n.lastName,
                      hintText: l10n.enterLastName,
                      prefixIcon: Icons.person_outlined,
                      keyboardType: TextInputType.name,
                      textInputAction: TextInputAction.next,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return l10n.pleaseEnterLastName;
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(height: 20),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 700),
                    slideOffset: const Offset(0, 0.05),
                    child: PremiumTextField(
                      controller: _businessNameController,
                      labelText: l10n.businessName,
                      hintText: l10n.enterBusinessName,
                      prefixIcon: Icons.business_outlined,
                      keyboardType: TextInputType.text,
                      textInputAction: TextInputAction.next,
                      validator: (value) {
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(height: 20),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 700),
                    slideOffset: const Offset(0, 0.05),
                    child: PremiumTextField(
                      controller: _emailController,
                      labelText: l10n.emailAddress,
                      hintText: l10n.enterYourEmail,
                      prefixIcon: Icons.email_outlined,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _handleNext(),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return l10n.pleaseEnterEmail;
                        }
                        final emailRegex = RegExp(
                          r'^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$',
                        );
                        if (!emailRegex.hasMatch(value)) {
                          return l10n.pleaseEnterValidEmail;
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(height: 36),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 800),
                    child: PremiumButton(
                      onPressed: _handleNext,
                      primaryColor: tenantProvider.primaryColor,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            l10n.continueButton,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward, size: 22, color: Colors.white),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 900),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          l10n.alreadyHaveAccountLogin,
                          style: TextStyle(
                            fontSize: 15,
                            color: theme.colorScheme.onSurface.withOpacity(0.7),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.pushReplacementNamed(context, '/login');
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 4,
                            ),
                          ),
                          child: Text(
                            l10n.login,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 15),

                  // Security Badges
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 1000),
                    child: Column(
                      children: [
                        Text(
                          l10n.bankGradeSecurity,
                          style: TextStyle(
                            fontSize: 12,
                            color: theme.colorScheme.onSurface.withOpacity(0.5),
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _buildSecurityBadge('assets/badges/pci.png'),
                            const SizedBox(width: 16),
                            _buildSecurityBadge('assets/badges/iso.png'),
                            const SizedBox(width: 16),
                            _buildSecurityBadge('assets/badges/nist.png'),
                            const SizedBox(width: 16),
                            _buildSecurityBadge('assets/badges/aicpa.png'),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSecurityBadge(String assetPath) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Image.asset(
        assetPath,
        width: 56,
        height: 56,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return const SizedBox(width: 56, height: 56);
        },
      ),
    );
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _businessNameController.dispose();
    _emailController.dispose();
    super.dispose();
  }
}
