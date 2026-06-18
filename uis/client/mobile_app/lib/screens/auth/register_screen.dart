// ⚠️ DEPRECATED: This file is kept for backward compatibility
// New registration flow uses:
// - register_step1_screen.dart (Personal Information)
// - register_step2_screen.dart (Contact & Verification)
// - register_step3_screen.dart (Security)
// See /register-step1 route in main.dart

import '../../utils/text_case_utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../services/verification_service.dart';
import '../../config/app_theme.dart';
import '../../widgets/language_switcher_button.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/error_snackbar.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _businessNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _uinController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _agreeToTerms = false;

  // Verification states
  final VerificationService _verificationService = VerificationService();
  bool _isVerifyingNIN = false;
  bool _isVerifyingPhone = false;
  String? _ninVerificationMessage;
  String? _phoneVerificationMessage;
  bool? _ninIsValid;
  bool? _phoneIsValid;

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

  // Check if passwords match
  bool _doPasswordsMatch() {
    return _passwordController.text.isNotEmpty &&
        _confirmPasswordController.text.isNotEmpty &&
        _passwordController.text == _confirmPasswordController.text;
  }

  // Check if form is ready to submit
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

    setState(() {}); // Show loading state

    final authProvider = context.read<AuthProvider>();
    final fullName = _businessNameController.text.isNotEmpty ?
        '${_firstNameController.text.trim()} ${_lastNameController.text.trim()} - ${_businessNameController.text.trim()}'.trim()
      : '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}'.trim();
    final success = await authProvider.register(
      _emailController.text.trim(),
      _passwordController.text,
      fullName,
      _phoneController.text.trim(),
      uin: _uinController.text.trim().isNotEmpty
          ? _uinController.text.trim()
          : null,
    );

    if (!mounted) return;

    if (success) {
      // After successful registration, start onboarding (like web app)
      Navigator.pushReplacementNamed(
        context,
        '/onboarding-start',
      );
    } else {
      // Show error message
      ErrorSnackbar.show(
        context,
        authProvider.errorMessage ?? 'Registration failed',
        backgroundColor: tenantProvider.errorColor,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(l10n.createAccount),
        elevation: 0,
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
      body: SafeArea(
        child: SingleChildScrollView(
          physics:
              const ClampingScrollPhysics(), // Prevent continuous scrolling on mobile
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),

                // Logo (matching web app)
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    final tenant = tenantProvider.tenantConfig;
                    final primaryColor = tenantProvider.primaryColor;

                    return Column(
                      children: [
                        Center(
                          child: Container(
                            width: 96,
                            height: 96,
                            decoration: BoxDecoration(
                              color: primaryColor,
                              borderRadius: BorderRadius.circular(20),
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
                                      width: 64,
                                      height: 64,
                                      fit: BoxFit.contain,
                                      errorBuilder:
                                          (context, error, stackTrace) {
                                        return Text(
                                            toUpperCase(tenant.name.substring(0, 2)),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 38,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        );
                                      },
                                    )
                                  : Text(
                                      toUpperCase(tenant.name.substring(0, 2)),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 38,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Title (matching web app)
                        Text(
                          l10n.welcomeTo(tenantProvider.appName),
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.color,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 8),

                Text(
                  'Create your account to get started',
                  style: TextStyle(
                    fontSize: 15,
                    color: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.color
                        ?.withOpacity(0.7),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),

                // First Name
                TextFormField(
                  controller: _firstNameController,
                  keyboardType: TextInputType.name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: l10n.firstName,
                    hintText: l10n.enterFirstName,
                    prefixIcon: Icon(
                      Icons.person_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your first name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Last Name
                TextFormField(
                  controller: _lastNameController,
                  keyboardType: TextInputType.name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: l10n.lastName,
                    hintText: l10n.enterLastName,
                    prefixIcon: Icon(
                      Icons.person_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your last name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _businessNameController,
                  keyboardType: TextInputType.name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: 'Business Name (optional)',
                    hintText: 'Enter your business name',
                    prefixIcon: Icon(
                      Icons.business_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Email
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: l10n.emailAddress,
                    hintText: l10n.enterYourEmail,
                    prefixIcon: Icon(
                      Icons.email_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your email';
                    }
                    final emailRegex = RegExp(
                      r'^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$',
                    );
                    if (!emailRegex.hasMatch(value)) {
                      return 'Please enter a valid email address';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Phone
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  onChanged: (value) async {
                    // Verify phone number as user types (when valid length entered)
                    if (value.length >= 9) {
                      setState(() {
                        _isVerifyingPhone = true;
                        _phoneVerificationMessage = null;
                        _phoneIsValid = null;
                      });

                      final result = await _verificationService
                          .verifyPhoneNumber('+234$value');

                      if (mounted) {
                        setState(() {
                          _isVerifyingPhone = false;
                          _phoneIsValid = result['valid'] as bool?;
                          _phoneVerificationMessage =
                              result['message'] as String?;
                        });
                      }
                    } else {
                      setState(() {
                        _phoneVerificationMessage = null;
                        _phoneIsValid = null;
                      });
                    }
                  },
                  decoration: InputDecoration(
                    labelText: l10n.phoneNumber,
                    hintText: l10n.enterPhoneNumber,
                    prefixIcon: Icon(
                      Icons.phone_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
                    prefixText: '+234 ',
                    suffixIcon: _isVerifyingPhone
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: Padding(
                              padding: EdgeInsets.all(12),
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : _phoneIsValid == true
                            ? Icon(
                                Icons.check_circle,
                                color: AppTheme.successColor,
                                size: 22,
                              )
                            : _phoneIsValid == false
                                ? Icon(
                                    Icons.error,
                                    color: AppTheme.errorColor,
                                    size: 22,
                                  )
                                : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: _phoneIsValid == false
                            ? AppTheme.errorColor
                            : Theme.of(context)
                                .colorScheme
                                .outline
                                .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: _phoneIsValid == false
                            ? AppTheme.errorColor
                            : Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: AppTheme.errorColor,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: AppTheme.errorColor,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your phone number';
                    }
                    if (value.length < 10) {
                      return 'Please enter a valid phone number';
                    }
                    final phoneRegex = RegExp(r'^[789]\d{9}$');
                    if (!phoneRegex.hasMatch(value)) {
                      return 'Please enter a valid Nigerian phone number';
                    }
                    if (_phoneIsValid == false) {
                      return _phoneVerificationMessage ??
                          'Invalid phone number';
                    }
                    return null;
                  },
                ),
                if (_phoneVerificationMessage != null &&
                    _phoneController.text.length >= 10) ...[
                  const SizedBox(height: 4),
                  Text(
                    _phoneVerificationMessage!,
                    style: TextStyle(
                      fontSize: 12,
                      color: _phoneIsValid == true
                          ? AppTheme.successColor
                          : AppTheme.errorColor,
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                // UIN - Unique Identification Number (NIN)
                TextFormField(
                  controller: _uinController,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  maxLength: 11,
                  onChanged: (value) async {
                    // Verify NIN as user types (when 11 digits entered)
                    if (value.length == 11) {
                      setState(() {
                        _isVerifyingNIN = true;
                        _ninVerificationMessage = null;
                        _ninIsValid = null;
                      });

                      final result =
                          await _verificationService.verifyNIN(value);

                      if (mounted) {
                        setState(() {
                          _isVerifyingNIN = false;
                          _ninIsValid = result['valid'] as bool?;
                          _ninVerificationMessage =
                              result['message'] as String?;
                        });
                      }
                    } else {
                      setState(() {
                        _ninVerificationMessage = null;
                        _ninIsValid = null;
                      });
                    }
                  },
                  decoration: InputDecoration(
                    labelText: l10n.nationalIdentificationNumber,
                    hintText: l10n.enterNIN,
                    prefixIcon: Icon(
                      Icons.badge_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
                    suffixIcon: _isVerifyingNIN
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: Padding(
                              padding: EdgeInsets.all(12),
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : _ninIsValid == true
                            ? Icon(
                                Icons.check_circle,
                                color: AppTheme.successColor,
                                size: 22,
                              )
                            : _ninIsValid == false
                                ? Icon(
                                    Icons.error,
                                    color: AppTheme.errorColor,
                                    size: 22,
                                  )
                                : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: _ninIsValid == false
                            ? AppTheme.errorColor
                            : Theme.of(context)
                                .colorScheme
                                .outline
                                .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: _ninIsValid == false
                            ? AppTheme.errorColor
                            : Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: AppTheme.errorColor,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: AppTheme.errorColor,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                    counterText: '',
                  ),
                  validator: (value) {
                    if (value != null && value.isNotEmpty) {
                      if (value.length != 11) {
                        return 'NIN must be 11 digits';
                      }
                      if (!RegExp(r'^\d{11}$').hasMatch(value)) {
                        return 'NIN must contain only digits';
                      }
                      if (_ninIsValid == false) {
                        return _ninVerificationMessage ?? 'Invalid NIN';
                      }
                    }
                    return null;
                  },
                ),
                if (_ninVerificationMessage != null &&
                    _uinController.text.length == 11) ...[
                  const SizedBox(height: 4),
                  Text(
                    _ninVerificationMessage!,
                    style: TextStyle(
                      fontSize: 12,
                      color: _ninIsValid == true
                          ? AppTheme.successColor
                          : AppTheme.errorColor,
                    ),
                  ),
                ],
                const SizedBox(height: 16),

                // Password
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: l10n.password,
                    hintText: l10n.createPassword,
                    prefixIcon: Icon(
                      Icons.lock_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your password';
                    }
                    if (!_isPasswordValid(value)) {
                      return 'Password does not meet requirements';
                    }
                    return null;
                  },
                  onChanged: (value) {
                    setState(
                        () {}); // Trigger rebuild to show password requirements and update confirm password checkmark
                  },
                ),
                // Password requirements
                if (_passwordController.text.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _buildPasswordRequirements(_passwordController.text),
                ],
                const SizedBox(height: 16),

                // Confirm Password
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _handleRegister(),
                  decoration: InputDecoration(
                    labelText: l10n.confirmPassword,
                    hintText: l10n.reEnterPassword,
                    prefixIcon: Icon(
                      Icons.lock_outlined,
                      color: Theme.of(context).colorScheme.primary,
                      size: 22,
                    ),
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
                                  color: Theme.of(context).colorScheme.primary,
                                  size: 24,
                                ),
                              ),
                              IconButton(
                                icon: Icon(
                                  _obscureConfirmPassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
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
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                            onPressed: () {
                              setState(() {
                                _obscureConfirmPassword =
                                    !_obscureConfirmPassword;
                              });
                            },
                          ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withOpacity(0.5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 2,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 1,
                      ),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: Theme.of(context).colorScheme.error,
                        width: 2,
                      ),
                    ),
                    filled: true,
                    fillColor: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest
                        .withOpacity(0.3),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
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
                    setState(
                        () {}); // Trigger rebuild to show checkmark when passwords match
                  },
                ),
                const SizedBox(height: 20),

                // Terms and Conditions
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return Row(
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
                    );
                  },
                ),
                const SizedBox(height: 24),

                // Register Button
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return SizedBox(
                      height: 56,
                      child: ElevatedButton(
                        onPressed: (authProvider.isLoading || !_isFormReady())
                            ? null
                            : _handleRegister,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: tenantProvider.primaryColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 2,
                          disabledBackgroundColor:
                              tenantProvider.surfaceColor.withOpacity(0.5),
                          disabledForegroundColor:
                              AppTheme.getTextSecondary(context),
                        ),
                        child: authProvider.isLoading
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white),
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.person_add, size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    l10n.startOnboarding,
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 32),

                // Divider
                Consumer<TenantProvider>(
                  builder: (context, tenantProvider, _) {
                    return Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Divider(
                                color: AppTheme.getTextSecondary(context)
                                    .withOpacity(0.3),
                                thickness: 1,
                              ),
                            ),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                l10n.or,
                                style: TextStyle(
                                  color: AppTheme.getTextSecondary(context),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Divider(
                                color: AppTheme.getTextSecondary(context)
                                    .withOpacity(0.3),
                                thickness: 1,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),

                        // Login Link
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              l10n.alreadyHaveAccountLogin,
                              style: TextStyle(
                                fontSize: 15,
                                color: AppTheme.getTextSecondary(context),
                              ),
                            ),
                            TextButton(
                              onPressed: () {
                                Navigator.pushReplacementNamed(
                                    context, '/login');
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
                                  color: tenantProvider.primaryColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
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
    _firstNameController.dispose();
    _lastNameController.dispose();
    _businessNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _uinController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }
}
