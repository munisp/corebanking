import '../../utils/text_case_utils.dart';
import 'package:flutter/material.dart';
import '../../config/app_theme.dart';
import 'package:provider/provider.dart';
import '../../services/local_storage_service.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/error_snackbar.dart';
import '../../widgets/language_switcher_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _rememberMe = false;

  @override
  void initState() {
    super.initState();
    _loadRememberedEmail();
  }

  // Load saved email if remember me was previously checked
  Future<void> _loadRememberedEmail() async {
    try {
      final rememberedEmail =
          await LocalStorageService.getString('remembered_email');
      final wasRememberMeChecked =
          await LocalStorageService.getBool('remember_me') ?? false;

      if (rememberedEmail != null && wasRememberMeChecked) {
        setState(() {
          _emailController.text = rememberedEmail;
          _rememberMe = true;
        });
      }
    } catch (e) {
      // Handle error silently
      debugPrint('Error loading remembered email: $e');
    }
  }

  // Save email if remember me is checked, or clear if unchecked
  Future<void> _saveRememberedEmail() async {
    try {
      if (_rememberMe && _emailController.text.trim().isNotEmpty) {
        await LocalStorageService.setString(
            'remembered_email', _emailController.text.trim());
        await LocalStorageService.setBool('remember_me', true);
      } else {
        await LocalStorageService.remove('remembered_email');
        await LocalStorageService.setBool('remember_me', false);
      }
    } catch (e) {
      debugPrint('Error saving remembered email: $e');
    }
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    // CRITICAL: Ensure tenant is loaded before making API calls
    final tenantProvider = context.read<TenantProvider>();
    if (tenantProvider.isLoading) {
      // Wait for tenant to finish loading
      while (tenantProvider.isLoading) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (!mounted) return;
      }
    }

    setState(() {}); // Show loading state

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (!mounted) return;

    if (success) {
      // Save email if remember me is checked
      await _saveRememberedEmail();

      // After successful login, navigate directly to dashboard (like web app)
      Navigator.pushReplacementNamed(context, '/dashboard');
    } else {
      // Show error message with code
      setState(() {}); // Triggers rebuild to show error
      final l10n = AppLocalizations.of(context);
      if (l10n != null && authProvider.lastError != null) {
        ErrorSnackbar.showError(
          context,
          authProvider.lastError!,
          showErrorCode: true,
        );
      } else if (authProvider.errorMessage != null) {
        ErrorSnackbar.show(
          context,
          authProvider.errorMessage ?? l10n!.error,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    final l10n = AppLocalizations.of(context);
    
    // Safety check: wait for localizations to be ready
    if (l10n == null) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return Theme(
      data: themeProvider.lightTheme,
      child: Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text(l10n.login),
        elevation: 0,
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        foregroundColor: Theme.of(context).textTheme.bodyLarge?.color,
        actions: [
          LanguageSwitcherButton(
            isDark: themeProvider.isDarkMode,
          ),
          const SizedBox(width: 4),
          // IconButton(
          //   icon: Icon(
          //     themeProvider.isDarkMode ? Icons.light_mode : Icons.dark_mode,
          //   ),
          //   onPressed: () {
          //     themeProvider.toggleTheme();
          //   },
          // ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            SingleChildScrollView(
              physics:
                  const ClampingScrollPhysics(), // Prevent continuous scrolling on mobile
              padding: const EdgeInsets.all(24.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 40),

                    // Logo
                    Center(
                      child: Image.asset(
                        'assets/icons/bp.png',
                        width: 96,
                        height: 96,
                        fit: BoxFit.contain,
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Inline error message (if any)
                    if (authProvider.errorMessage != null && authProvider.errorMessage!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16.0),
                        child: Text(
                          authProvider.errorMessage!,
                          style: const TextStyle(color: Colors.red, fontSize: 15, fontWeight: FontWeight.w600),
                          textAlign: TextAlign.center,
                        ),
                      ),

                    // Welcome text (matching web app)
                    Consumer<TenantProvider>(
                      builder: (context, tenantProvider, _) {
                        return Text(
                          l10n.welcomeMessage(tenantProvider.appName),
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.color,
                          ),
                          textAlign: TextAlign.center,
                        );
                      },
                    ),

                    const SizedBox(height: 8),

                    Text(
                      l10n.loginToYourAccount,
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

                    const SizedBox(height: 40),

                    // Email field (matching web app)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.email,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color:
                                Theme.of(context).textTheme.bodyMedium?.color,
                          ),
                        ),
                        const SizedBox(height: 4),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          decoration: InputDecoration(
                            hintText: l10n.email,
                            prefixIcon: Icon(
                              Icons.email_outlined,
                              color: Theme.of(context).colorScheme.primary,
                              size: 20,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
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
                            fillColor: Colors.grey[50],
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 20,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return l10n.email;
                            }
                            final emailRegex = RegExp(
                              r'^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$',
                            );
                            if (!emailRegex.hasMatch(value)) {
                              return l10n.email;
                            }
                            return null;
                          },
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    // Password field (matching web app)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.password,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w500,
                            color:
                                Theme.of(context).textTheme.bodyMedium?.color,
                          ),
                        ),
                        const SizedBox(height: 4),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _handleLogin(),
                          decoration: InputDecoration(
                            hintText: l10n.password,
                            prefixIcon: Icon(
                              Icons.lock_outlined,
                              color: Theme.of(context).colorScheme.primary,
                              size: 20,
                            ),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                color: AppTheme.textSecondary,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
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
                            fillColor: Colors.grey[50],
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 20,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return l10n.password;
                            }
                            if (value.length < 6) {
                              return l10n.password;
                            }
                            return null;
                          },
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Remember me & Forgot password
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Consumer<TenantProvider>(
                          builder: (context, tenantProvider, _) {
                            return Row(
                              children: [
                                SizedBox(
                                  height: 24,
                                  width: 24,
                                  child: Checkbox(
                                    value: _rememberMe,
                                    onChanged: (value) {
                                      setState(() {
                                        _rememberMe = value ?? false;
                                      });
                                      // Save preference immediately when toggled
                                      _saveRememberedEmail();
                                    },
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    activeColor: tenantProvider.primaryColor,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  l10n.rememberMe,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: AppTheme.textSecondary,
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.pushNamed(context, '/forgot-password');
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                          ),
                          child: Consumer<TenantProvider>(
                            builder: (context, tenantProvider, _) {
                              return Text(
                                l10n.forgotPassword,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: tenantProvider.primaryColor,
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Login button (matching web app)
                    Consumer<TenantProvider>(
                      builder: (context, tenantProvider, _) {
                        final isLoading = authProvider.isLoading;
                        return GestureDetector(
                          onTap: isLoading
                              ? null
                              : () {
                                  // Dismiss keyboard before login to prevent scroll issues
                                  FocusScope.of(context).unfocus();
                                  _handleLogin();
                                },
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            height: 56,
                            decoration: BoxDecoration(
                              color: isLoading
                                  ? tenantProvider.primaryColor.withOpacity(0.4)
                                  : tenantProvider.primaryColor,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: isLoading
                                  ? SizedBox(
                                      height: 24,
                                      width: 24,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        valueColor:
                                            const AlwaysStoppedAnimation<Color>(
                                                Colors.white),
                                      ),
                                    )
                                  : Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        const Icon(Icons.login,
                                            size: 20, color: Colors.white),
                                        const SizedBox(width: 8),
                                        Text(
                                          l10n.login,
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ],
                                    ),
                            ),
                          ),
                        );
                      },
                    ),

                    // Biometric login (disabled in web app, so disabled here too)
                    // Removed to match web app

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
                                    color: AppTheme.textSecondary.withOpacity(0.3),
                                    thickness: 1,
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16),
                                  child: Text(
                                    l10n.or,
                                    style: TextStyle(
                                      color: AppTheme.textSecondary,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Divider(
                                    color: AppTheme.textSecondary.withOpacity(0.3),
                                    thickness: 1,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 32),

                            // Register link with enhanced styling
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  l10n.dontHaveAccount,
                                  style: TextStyle(
                                    fontSize: 15,
                                    color: AppTheme.textSecondary,
                                  ),
                                ),
                                TextButton(
                                  onPressed: () {
                                    Navigator.pushNamed(context, '/register');
                                  },
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 4,
                                      vertical: 4,
                                    ),
                                  ),
                                  child: Text(
                                    l10n.register,
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

                    const SizedBox(height: 32),

                    // Security Compliance Badges
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Image.asset(
                          'badges/aicpa.png',
                          height: 80,
                          width: 80,
                          errorBuilder: (context, error, stackTrace) {
    debugPrint('🔴 Asset error: $error');
    return const SizedBox(width: 80, height: 80); // silent fallback
  },
                        ),
                        const SizedBox(width: 16),
                        Image.asset(
                          'badges/iso.png',
                          height: 80,
                          width: 80,
                          errorBuilder: (context, error, stackTrace) {
                            debugPrint('🔴 Asset error: $error');
                            return const SizedBox(width: 80, height: 80); // silent fallback
                          },
                        ),
                        const SizedBox(width: 16),
                        Image.asset(
                          'badges/nist.png',
                          height: 80,
                          width: 80,
                          errorBuilder: (context, error, stackTrace) {
                            debugPrint('🔴 Asset error: $error');
                            return const SizedBox(width: 80, height: 80); // silent fallback
                          },
                        ),
                        const SizedBox(width: 16),
                        Image.asset(
                          'badges/pci.png',
                          height: 80,
                          width: 80,
                          errorBuilder: (context, error, stackTrace) {
                            debugPrint('🔴 Asset error: $error');
                            return const SizedBox(width: 80, height: 80); // silent fallback
                          },
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
