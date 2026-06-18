import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/registration_data.dart';
import '../../providers/theme_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../services/verification_service.dart';
import '../../config/app_theme.dart';
import '../../widgets/registration_progress_indicator.dart';
import '../../widgets/animated_background.dart';
import '../../widgets/premium_animations.dart';
import '../../widgets/premium_widgets.dart';

import '../../l10n/app_localizations.dart';

/// Step 2 of registration: Contact & Verification
class RegisterStep2Screen extends StatefulWidget {
  final RegistrationData registrationData;

  const RegisterStep2Screen({
    super.key,
    required this.registrationData,
  });

  @override
  State<RegisterStep2Screen> createState() => _RegisterStep2ScreenState();
}

class _RegisterStep2ScreenState extends State<RegisterStep2Screen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _phoneController;
  late TextEditingController _uinController;

  // Verification states
  final VerificationService _verificationService = VerificationService();
  bool _isVerifyingNIN = false;
  bool _isVerifyingPhone = false;
  String? _ninVerificationMessage;
  String? _phoneVerificationMessage;
  bool? _ninIsValid;
  bool? _phoneIsValid;

  @override
  void initState() {
    super.initState();
    _phoneController = TextEditingController(
      text: widget.registrationData.phoneNumber,
    );
    _uinController = TextEditingController(
      text: widget.registrationData.uin ?? '',
    );
  }

  void _handleNext() {
    if (_formKey.currentState?.validate() ?? false) {
      final updatedData = widget.registrationData.copyWith(
        phoneNumber: _phoneController.text.trim(),
        uin: _uinController.text.trim().isNotEmpty
            ? _uinController.text.trim()
            : null,
      );

      Navigator.pushNamed(
        context,
        '/register-step3',
        arguments: updatedData,
      );
    }
  }

  void _handleBack() {
    final updatedData = widget.registrationData.copyWith(
      phoneNumber: _phoneController.text.trim(),
      uin: _uinController.text.trim().isNotEmpty
          ? _uinController.text.trim()
          : null,
    );

    Navigator.pop(context, updatedData);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
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
                      'Contact & Verification',
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
                      'Provide your contact details and verification info',
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
                      currentStep: 2,
                      totalSteps: 3,
                      stepLabels: const ['Personal', 'Contact', 'Security'],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Phone Number with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 500),
                    slideOffset: const Offset(0, 20),
                    child: PremiumTextField(
                      controller: _phoneController,
                      labelText: l10n.phoneNumber,
                      hintText: l10n.enterPhoneNumber,
                      prefixIcon: Icons.phone_outlined,
                      prefixText: '+234 ',
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
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
                      onChanged: (value) async {
                        if (value.length >= 10) {
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
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return l10n.pleaseEnterPhoneNumber;
                        }
                        if (value.length < 10) {
                          return l10n.pleaseEnterValidPhoneNumber;
                        }
                        final phoneRegex = RegExp(r'^[789]\d{9}$');
                        if (!phoneRegex.hasMatch(value)) {
                          return l10n.pleaseEnterValidNigerianNumber;
                        }
                        if (_phoneIsValid == false) {
                          return _phoneVerificationMessage ?? 'Invalid phone number';
                        }
                        return null;
                      },
                    ),
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

                  // NIN (Optional) with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 600),
                    slideOffset: const Offset(0, 20),
                    child: PremiumTextField(
                      controller: _uinController,
                      labelText: l10n.nationalIdentificationNumber,
                      hintText: l10n.enterNIN,
                      prefixIcon: Icons.badge_outlined,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      maxLength: 11,
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
                      onFieldSubmitted: (_) => _handleNext(),
                      onChanged: (value) async {
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
                  const SizedBox(height: 32),

                  // Continue Button with Animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 700),
                    child: PremiumButton(
                      onPressed: _handleNext,
                      isLoading: false,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            l10n.continueButton,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.arrow_forward, size: 20, color: Colors.white),
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
    _phoneController.dispose();
    _uinController.dispose();
    super.dispose();
  }
}
