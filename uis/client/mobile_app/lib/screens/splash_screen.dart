import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/tenant_provider.dart';

/// Splash screen displayed during app initialization
/// Handles tenant loading, authentication checks, and routing
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  // Animation constants
  static const _animationDuration = Duration(milliseconds: 1500);
  static const _minimumDisplayDuration = Duration(seconds: 3);
  static const _tenantLoadTimeout = Duration(seconds: 5);
  static const _authLoadTimeout = Duration(seconds: 10);
  static const _tenantPollInterval = Duration(milliseconds: 100);

  late final AnimationController _animationController;
  late final Animation<double> _fadeAnimation;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _animationController.forward();
    _navigateToNextScreen();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  /// Initialize fade and scale animations
  void _setupAnimations() {
    _animationController = AnimationController(
      duration: _animationDuration,
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeIn,
      ),
    );

    _scaleAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeOutBack,
      ),
    );
  }

  /// Navigate to appropriate screen after loading
  Future<void> _navigateToNextScreen() async {
    try {
      // Wait for minimum display duration
      await Future.delayed(_minimumDisplayDuration);
      if (!mounted) return;

      // Wait for tenant configuration to load
      await _waitForTenantLoad();
      if (!mounted) return;

      // Wait for authentication state
      await _waitForAuthLoad();
      if (!mounted) return;

      // Navigate based on authentication state
      await _navigateBasedOnAuthState();
    } catch (e, stackTrace) {
      _handleNavigationError(e, stackTrace);
    }
  }

  /// Wait for tenant provider to finish loading with timeout
  Future<void> _waitForTenantLoad() async {
    final tenantProvider = context.read<TenantProvider>();
    final maxAttempts = _tenantLoadTimeout.inMilliseconds ~/
        _tenantPollInterval.inMilliseconds;

    int attempts = 0;
    while (tenantProvider.isLoading && attempts < maxAttempts) {
      await Future.delayed(_tenantPollInterval);
      attempts++;
      if (!mounted) return;
    }

    if (attempts >= maxAttempts) {
      debugPrint('⚠️ Tenant loading timed out - proceeding anyway');
    }
  }

  /// Wait for auth provider to finish loading with timeout
  Future<void> _waitForAuthLoad() async {
    final authProvider = context.read<AuthProvider>();
    final maxAttempts = _authLoadTimeout.inMilliseconds ~/
        _tenantPollInterval.inMilliseconds;

    int attempts = 0;
    while (authProvider.isLoading && attempts < maxAttempts) {
      await Future.delayed(_tenantPollInterval);
      attempts++;
      if (!mounted) return;
    }

    if (attempts >= maxAttempts) {
      debugPrint('⚠️ Auth loading timed out - proceeding anyway');
    }
  }

  /// Navigate to the appropriate screen based on authentication state
  Future<void> _navigateBasedOnAuthState() async {
    final authProvider = context.read<AuthProvider>();

    if (authProvider.isAuthenticated) {
      _navigateForAuthenticatedUser(authProvider);
    } else {
      _navigateToLogin();
    }
  }

  /// Navigate authenticated user to appropriate screen
  void _navigateForAuthenticatedUser(AuthProvider authProvider) {
    debugPrint('✅ User authenticated - navigating to dashboard');

    if (authProvider.hasCompletedOnboarding) {
      Navigator.of(context).pushReplacementNamed('/dashboard');
    } else {
      Navigator.of(context).pushReplacementNamed('/register');
    }
  }

  /// Navigate to login screen
  void _navigateToLogin() {
    debugPrint('✅ User not authenticated - navigating to login');
    Navigator.of(context).pushReplacementNamed('/login');
  }

  /// Handle navigation errors by falling back to login screen
  void _handleNavigationError(Object error, StackTrace stackTrace) {
    debugPrint('❌ Error in splash navigation: $error');
    debugPrint('Stack trace: $stackTrace');

    if (!mounted) return;

    try {
      Navigator.of(context).pushReplacementNamed('/login');
    } catch (navError) {
      debugPrint('❌ Failed to navigate: $navError');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return Scaffold(
          body: Stack(
            children: [
              _buildGradientBackground(tenantProvider),
              _buildAnimatedCircles(),
              _buildContent(tenantProvider),
            ],
          ),
        );
      },
    );
  }

  /// Build animated gradient background
  Widget _buildGradientBackground(TenantProvider tenantProvider) {
    final primaryColor = tenantProvider.primaryColor;
    final secondaryColor = tenantProvider.secondaryColor;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            primaryColor,
            Color.lerp(primaryColor, Colors.purple, 0.3)!,
            secondaryColor,
          ],
        ),
      ),
    );
  }

  /// Build floating animated circles
  Widget _buildAnimatedCircles() {
    return Stack(
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _animationController,
          builder: (context, child) {
            final offset = math.sin(
              _animationController.value * 2 * math.pi + index,
            );

            return Positioned(
              top: 100 + (index * 200) + (offset * 30),
              right: -100 + (index * 50),
              child: Container(
                width: 200 + (index * 50),
                height: 200 + (index * 50),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.white.withOpacity(0.1),
                      Colors.white.withOpacity(0.05),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            );
          },
        );
      }),
    );
  }

  /// Build main content with logo and text
  Widget _buildContent(TenantProvider tenantProvider) {
    return Center(
      child: AnimatedBuilder(
        animation: _animationController,
        builder: (context, child) {
          return FadeTransition(
            opacity: _fadeAnimation,
            child: ScaleTransition(
              scale: _scaleAnimation,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildLogo(tenantProvider),
                  const SizedBox(height: 32),
                  _buildAppName(tenantProvider),
                  const SizedBox(height: 8),
                  _buildTagline(),
                  const SizedBox(height: 40),
                  _buildLoadingIndicator(),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  /// Build logo
  Widget _buildLogo(TenantProvider tenantProvider) {
    return Image.asset(
      'assets/icons/bp.png',
      width: 120,
      height: 120,
      fit: BoxFit.contain,
    );
  }

  /// Build app name text
  Widget _buildAppName(TenantProvider tenantProvider) {
    return Text(
      tenantProvider.appName,
      style: const TextStyle(
        fontSize: 36,
        fontWeight: FontWeight.bold,
        color: Colors.white,
        letterSpacing: 2,
      ),
    );
  }

  /// Build tagline text
  Widget _buildTagline() {
    return Text(
      'Your Financial Partner',
      style: TextStyle(
        fontSize: 16,
        color: Colors.white.withOpacity(0.8),
        letterSpacing: 1,
      ),
    );
  }

  /// Build circular loading indicator
  Widget _buildLoadingIndicator() {
    return const SizedBox(
      width: 40,
      height: 40,
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
        strokeWidth: 4,
      ),
    );
  }
}