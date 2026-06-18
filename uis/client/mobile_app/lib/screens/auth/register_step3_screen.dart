import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../models/registration_data.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../widgets/registration_progress_indicator.dart';
import '../../widgets/animated_background.dart';
import '../../widgets/premium_animations.dart';
import '../../widgets/premium_widgets.dart';
import '../../widgets/error_snackbar.dart';

import '../../l10n/app_localizations.dart';

/// Step 3 of registration: Security (Password & Terms)
class RegisterStep3Screen extends StatefulWidget {
  final RegistrationData registrationData;

  const RegisterStep3Screen({
    super.key,
    required this.registrationData,
  });

  @override
  State<RegisterStep3Screen> createState() => _RegisterStep3ScreenState();
}

class _RegisterStep3ScreenState extends State<RegisterStep3Screen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _passwordController;
  late TextEditingController _confirmPasswordController;

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _agreeToTerms = false;

  @override
  void initState() {
    super.initState();
    _passwordController = TextEditingController(
      text: widget.registrationData.password,
    );
    _confirmPasswordController = TextEditingController(
      text: widget.registrationData.confirmPassword,
    );
    _agreeToTerms = widget.registrationData.agreeToTerms;
  }

  // Password validation
  Map<String, bool> _validatePassword(String password) {
    return {
      'hasMinLength': password.length >= 8,
      'hasNumber': RegExp(r'\d').hasMatch(password),
      'hasUpperCase': RegExp(r'[A-Z]').hasMatch(password),
      'hasLowerCase': RegExp(r'[a-z]').hasMatch(password),
      'hasSpecialChar':
          RegExp(r"[!@#$%^&*()_+\-=\[\]{};':\\\|,.<>\/?]").hasMatch(password),
    };
  }

  bool _isPasswordValid(String password) {
    final validation = _validatePassword(password);
    return validation.values.every((value) => value == true);
  }

  bool _doPasswordsMatch() {
    return _passwordController.text.isNotEmpty &&
        _confirmPasswordController.text.isNotEmpty &&
        _passwordController.text == _confirmPasswordController.text;
  }

  bool _isFormReady() {
    return _doPasswordsMatch() &&
        _isPasswordValid(_passwordController.text) &&
        _agreeToTerms;
  }

  Future<void> _handleRegister() async {
    final tenantProvider = context.read<TenantProvider>();
    final l10n = AppLocalizations.of(context)!;

    if (!_agreeToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Text(l10n.agreeToTerms),
              ),
            ],
          ),
          backgroundColor: tenantProvider.errorColor,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          duration: const Duration(seconds: 4),
        ),
      );
      return;
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() {});

    final authProvider = context.read<AuthProvider>();
    final fullName = widget.registrationData.fullName;

    final success = await authProvider.register(
      widget.registrationData.email,
      _passwordController.text,
      fullName,
      widget.registrationData.phoneNumber,
      uin: widget.registrationData.uin,
    );

    if (!mounted) return;

    if (success) {
      Navigator.pushReplacementNamed(
        context,
        '/onboarding-start',
      );
    } else {
      ErrorSnackbar.show(
        context,
        authProvider.errorMessage ?? 'Registration failed',
        backgroundColor: tenantProvider.errorColor,
      );
    }
  }

  void _handleBack() {
    final updatedData = widget.registrationData.copyWith(
      password: _passwordController.text,
      confirmPassword: _confirmPasswordController.text,
      agreeToTerms: _agreeToTerms,
    );

    Navigator.pop(context, updatedData);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = context.watch<AuthProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    final tenantProvider = context.watch<TenantProvider>();
    final l10n = AppLocalizations.of(context)!;

    return WillPopScope(
      onWillPop: () async {
        _handleBack();
        return false;
      },
      child: Scaffold(
        backgroundColor: theme.brightness == Brightness.dark ? Colors.black : Colors.white,
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          title: Text(l10n.createAccount),
          elevation: 0,
          backgroundColor: Colors.transparent,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _handleBack,
          ),
          actions: [
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

                  // Logo Section with Animation
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
                                        tenantProvider.appName.substring(0, 2).toUpperCase(),
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
                                  tenantProvider.appName.substring(0, 2).toUpperCase(),
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

                  // Title with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 200),
                    child: Text(
                      'Secure Your Account',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                        letterSpacing: -0.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Subtitle with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 300),
                    child: Text(
                      'Create a strong password to protect your account',
                      style: TextStyle(
                        fontSize: 15,
                        color: theme.colorScheme.onSurface.withOpacity(0.6),
                        height: 1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Progress Indicator with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 400),
                    child: RegistrationProgressIndicator(
                      currentStep: 3,
                      totalSteps: 3,
                      stepLabels: const ['Personal', 'Contact', 'Security'],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Password with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 500),
                    slideOffset: const Offset(0, 20),
                    child: PremiumTextField(
                      controller: _passwordController,
                      labelText: l10n.password,
                      hintText: l10n.createPassword,
                      prefixIcon: Icons.lock_outlined,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.next,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return l10n.pleaseEnterPassword;
                        }
                        if (!_isPasswordValid(value)) {
                          return 'Password does not meet requirements';
                        }
                        return null;
                      },
                      onChanged: (value) {
                        setState(() {});
                      },
                    ),
                  ),

                  // Password requirements
                  if (_passwordController.text.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    _buildPasswordRequirements(_passwordController.text),
                  ],
                  const SizedBox(height: 16),

                  // Confirm Password with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 600),
                    slideOffset: const Offset(0, 20),
                    child: PremiumTextField(
                      controller: _confirmPasswordController,
                      labelText: l10n.confirmPassword,
                      hintText: l10n.reEnterPassword,
                      prefixIcon: Icons.lock_outlined,
                      obscureText: _obscureConfirmPassword,
                      textInputAction: TextInputAction.done,
                      suffixIcon: _confirmPasswordController.text.isNotEmpty &&
                              _confirmPasswordController.text ==
                                  _passwordController.text &&
                              _passwordController.text.isNotEmpty
                          ? Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.only(right: 8.0),
                                  child: Icon(
                                    Icons.check_circle,
                                    color: theme.colorScheme.primary,
                                    size: 24,
                                  ),
                                ),
                                IconButton(
                                  icon: Icon(
                                    _obscureConfirmPassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _obscureConfirmPassword =
                                          !_obscureConfirmPassword;
                                    });
                                  },
                                ),
                              ],
                            )
                          : IconButton(
                              icon: Icon(
                                _obscureConfirmPassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscureConfirmPassword =
                                      !_obscureConfirmPassword;
                                });
                              },
                            ),
                      onFieldSubmitted: (_) => _handleRegister(),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please confirm your password';
                        }
                        if (value != _passwordController.text) {
                          return 'Passwords do not match';
                        }
                        return null;
                      },
                      onChanged: (value) {
                        setState(() {});
                      },
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Terms and Conditions
                  Row(
                    children: [
                      SizedBox(
                        height: 24,
                        width: 24,
                        child: Checkbox(
                          value: _agreeToTerms,
                          onChanged: (value) {
                            setState(() {
                              _agreeToTerms = value ?? false;
                            });
                          },
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(4),
                          ),
                          activeColor: tenantProvider.primaryColor,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _agreeToTerms = !_agreeToTerms;
                            });
                          },
                          child: RichText(
                            text: TextSpan(
                              style: TextStyle(
                                fontSize: 14,
                                color: AppTheme.getTextSecondary(context),
                              ),
                              children: [
                                TextSpan(text: l10n.iAgreeToThe),
                                TextSpan(
                                  text: l10n.termsAndConditions,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: tenantProvider.primaryColor,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Complete Registration Button with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 700),
                    child: PremiumButton(
                      onPressed: (authProvider.isLoading || !_isFormReady())
                          ? null
                          : _handleRegister,
                      isLoading: authProvider.isLoading,
                      child: authProvider.isLoading
                          ? const SizedBox(
                              height: 24,
                              width: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Complete Registration',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                SizedBox(width: 8),
                                Icon(Icons.check_circle, size: 20, color: Colors.white),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Security Badges
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 800),
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
        ),  // AnimatedBackground
      ),  // Scaffold
    );  // WillPopScope
  }

  Widget _buildPasswordRequirements(String password) {
    final l10n = AppLocalizations.of(context)!;
    final validation = _validatePassword(password);
    final passwordsMatch = _doPasswordsMatch();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withOpacity(0.3),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.passwordRequirements,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          _buildRequirementItem(
              l10n.atLeast8Characters, validation['hasMinLength']!),
          _buildRequirementItem(
              l10n.atLeastOneNumber, validation['hasNumber']!),
          _buildRequirementItem(
              l10n.atLeastOneUppercase, validation['hasUpperCase']!),
          _buildRequirementItem(
              l10n.atLeastOneLowercase, validation['hasLowerCase']!),
          _buildRequirementItem(
              l10n.atLeastOneSpecialChar, validation['hasSpecialChar']!),
          _buildRequirementItem(l10n.passwordsMustMatch, passwordsMatch),
        ],
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

  Widget _buildRequirementItem(String text, bool isValid) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              Text(
                isValid ? '✓' : '○',
                style: TextStyle(
                  fontSize: 12,
                  color: isValid
                      ? tenantProvider.successColor
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                text,
                style: TextStyle(
                  fontSize: 12,
                  color: isValid
                      ? tenantProvider.successColor
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }
}
