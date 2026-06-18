import '../../utils/text_case_utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/local_storage_service.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../providers/tenant_provider.dart';
import '../../widgets/animated_background.dart';
import '../../widgets/premium_animations.dart';
import '../../widgets/premium_widgets.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/error_snackbar.dart';

class PremiumLoginScreen extends StatefulWidget {
  const PremiumLoginScreen({super.key});

  @override
  State<PremiumLoginScreen> createState() => _PremiumLoginScreenState();
}

class _PremiumLoginScreenState extends State<PremiumLoginScreen> {
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
      debugPrint('Error loading remembered email: $e');
    }
  }

  Future<void> _handleLogin() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    if (_rememberMe) {
      await LocalStorageService.setString(
          'remembered_email', _emailController.text);
      await LocalStorageService.setBool('remember_me', true);
    } else {
      await LocalStorageService.remove('remembered_email');
      await LocalStorageService.setBool('remember_me', false);
    }

    final authProvider = context.read<AuthProvider>();
    setState(() {});

    final success = await authProvider.login(
      _emailController.text,
      _passwordController.text,
    );

    if (!mounted) return;

    if (success) {
      Navigator.pushReplacementNamed(context, '/dashboard');
    } else {
      setState(() {});
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
    final theme = Theme.of(context);
    final authProvider = context.watch<AuthProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    final tenantProvider = context.watch<TenantProvider>();
    final l10n = AppLocalizations.of(context);

    if (l10n == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: Icon(
              themeProvider.isDarkMode ? Icons.light_mode : Icons.dark_mode,
            ),
            onPressed: () => themeProvider.toggleTheme(),
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
                  const SizedBox(height: 40),

                  // Logo with premium animation
                  ScaleInAnimation(
                    duration: const Duration(milliseconds: 600),
                    child: Center(
                      child: Hero(
                        tag: 'app_logo',
                        child: Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                tenantProvider.primaryColor,
                                Color.lerp(tenantProvider.primaryColor,
                                    Colors.purple, 0.3)!,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(26),
                            boxShadow: [
                              BoxShadow(
                                color:
                                    tenantProvider.primaryColor.withOpacity(0.4),
                                blurRadius: 28,
                                offset: const Offset(0, 14),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(26),
                            child: Image.asset(
                              'assets/icons/bp.png',
                              width: 100,
                              height: 100,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                if (tenantProvider.tenantConfig.logo.isNotEmpty) {
                                  return Image.network(
                                    tenantProvider.tenantConfig.logo,
                                    width: 100,
                                    height: 100,
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) {
                                      return Center(
                                        child: Text(
                                          toUpperCase(tenantProvider.appName
                                              .substring(0, 2)),
                                          style: const TextStyle(
                                            fontSize: 40,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                        ),
                                      );
                                    },
                                  );
                                }
                                return Center(
                                  child: Text(
                                    toUpperCase(
                                        tenantProvider.appName.substring(0, 2)),
                                    style: const TextStyle(
                                      fontSize: 40,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 36),

                  // Welcome text with animation
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 200),
                    child: Text(
                      'Welcome to ${tenantProvider.appName}',
                      style: TextStyle(
                        fontSize: 30,
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
                      l10n.loginToYourAccount,
                      style: TextStyle(
                        fontSize: 16,
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 40),

                  // Email field
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 400),
                    slideOffset: const Offset(0, 0.05),
                    child: PremiumTextField(
                      controller: _emailController,
                      labelText: l10n.emailAddress,
                      hintText: l10n.enterYourEmail,
                      prefixIcon: Icons.email_outlined,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your email';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Password field
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 500),
                    slideOffset: const Offset(0, 0.05),
                    child: PremiumTextField(
                      controller: _passwordController,
                      labelText: l10n.password,
                      hintText: l10n.enterPassword,
                      prefixIcon: Icons.lock_outlined,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _handleLogin(),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: theme.colorScheme.onSurface.withOpacity(0.6),
                        ),
                        onPressed: () {
                          setState(() => _obscurePassword = !_obscurePassword);
                        },
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your password';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Remember me & Forgot password
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 600),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            SizedBox(
                              height: 24,
                              width: 24,
                              child: Checkbox(
                                value: _rememberMe,
                                onChanged: (value) {
                                  setState(() => _rememberMe = value ?? false);
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
                                color: theme.colorScheme.onSurface.withOpacity(0.8),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.pushNamed(context, '/forgot-password');
                          },
                          child: Text(
                            l10n.forgotPassword,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: tenantProvider.primaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Login button
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 700),
                    child: PremiumButton(
                      onPressed: authProvider.isLoading ? null : _handleLogin,
                      isLoading: authProvider.isLoading,
                      primaryColor: tenantProvider.primaryColor,
                      child: Text(
                        l10n.login,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Divider
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 800),
                    child: Row(
                      children: [
                        Expanded(
                          child: Divider(
                            color: theme.colorScheme.outline.withOpacity(0.3),
                            thickness: 1,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            l10n.or,
                            style: TextStyle(
                              color: theme.colorScheme.onSurface.withOpacity(0.6),
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Divider(
                            color: theme.colorScheme.outline.withOpacity(0.3),
                            thickness: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Register link
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 900),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          l10n.dontHaveAccountSignUp,
                          style: TextStyle(
                            fontSize: 15,
                            color: theme.colorScheme.onSurface.withOpacity(0.7),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.pushNamed(context, '/register');
                          },
                          child: Text(
                            l10n.signUp,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: tenantProvider.primaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 48),

                  // Security Badges
                  FadeInAnimation(
                    delay: const Duration(milliseconds: 1000),
                    child: Column(
                      children: [
                        Text(
                          'Secured & Trusted',
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
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
