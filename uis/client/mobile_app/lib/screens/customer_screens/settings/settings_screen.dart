import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../config/app_theme.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/theme_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../providers/language_provider.dart';
import '../../../services/biometric_service.dart';
import '../../../l10n/app_localizations.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _biometricService = BiometricService();
  bool _biometricEnabled = false;
  bool _notificationsEnabled = true;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final enabled = await _biometricService.isBiometricEnabled();
    setState(() {
      _biometricEnabled = enabled;
    });
  }

  Future<void> _toggleBiometric(bool value) async {
    if (value) {
      // Enable biometric
      final success = await _biometricService.authenticate(
        localizedReason: 'Enable biometric authentication',
      );

      if (success) {
        await _biometricService.enableBiometric();
        setState(() {
          _biometricEnabled = true;
        });

        if (!mounted) return;

        final l10n = AppLocalizations.of(context)!;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${l10n.success}: Biometric enabled'),
            backgroundColor: AppTheme.successColor,
          ),
        );
      }
    } else {
      // Disable biometric
      await _biometricService.disableBiometric();
      setState(() {
        _biometricEnabled = false;
      });

      if (!mounted) return;

      final l10n = AppLocalizations.of(context)!;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${l10n.warning}: Biometric disabled'),
          backgroundColor: AppTheme.warningColor,
        ),
      );
    }
  }

  Future<void> _handleLogout() async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.logout),
        content: Text('${l10n.confirm} ${l10n.logout.toLowerCase()}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.cancel),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
            ),
            child: Text(l10n.logout),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await context.read<AuthProvider>().logout();

      if (!mounted) return;

      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
    }
  }

  void _showKycDialog(BuildContext context) async {
    final authProvider = context.read<AuthProvider>();
    final user = authProvider.currentUser;
    final l10n = AppLocalizations.of(context)!;

    // Check if kyc_verification_url exists
    if (user?.kycVerificationUrl != null && user!.kycVerificationUrl!.isNotEmpty) {
      // Navigate to external URL
      final url = Uri.parse(user.kycVerificationUrl!);
      
      try {
        if (await canLaunchUrl(url)) {
          await launchUrl(
            url,
            mode: LaunchMode.externalApplication,
          );
        } else {
          if (!context.mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Could not open KYC verification URL'),
              backgroundColor: AppTheme.errorColor,
            ),
          );
        }
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error opening KYC verification: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
      return;
    }

    // If no kyc_verification_url, show the dialog (fallback to internal flow)
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.verified_user, color: Colors.blue[700]),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                l10n.completeKYC,
                style: TextStyle(fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Complete your Know Your Customer (KYC) verification to:',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[700],
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 16),
            _buildBenefitItem('Increase transaction limits'),
            _buildBenefitItem('Access loans and credit facilities'),
            // _buildBenefitItem('Apply for insurance products'),
            _buildBenefitItem('Unlock premium features'),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.blue[700], size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n.kycRequiredDocuments,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.blue[900],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.later),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushNamed(
                context,
                '/kyc-documents',
                arguments: {'isKycCompletion': true},
              );
            },
            child: Text(l10n.startKYC),
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(Icons.check_circle, color: Colors.green[600], size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.currentUser;

    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        final l10n = AppLocalizations.of(context)!;
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          appBar: AppBar(
            title: Text(l10n.settings),
            backgroundColor: Colors.transparent,
            elevation: 0,
            foregroundColor: Colors.white,
            flexibleSpace: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    tenantProvider.primaryColor,
                    tenantProvider.secondaryColor,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
          body: ListView(
            padding: EdgeInsets.zero,
            children: [
              // Profile section with gradient header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      tenantProvider.primaryColor,
                      tenantProvider.secondaryColor,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(32),
                    bottomRight: Radius.circular(32),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: tenantProvider.primaryColor.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.3),
                          width: 3,
                        ),
                      ),
                      child: CircleAvatar(
                        radius: 45,
                        backgroundColor: Colors.white.withValues(alpha: 0.25),
                        child: Text(
                          user?.fullName.substring(0, 1).toUpperCase() ?? 'U',
                          style: const TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      user?.fullName ?? 'User',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      user?.email ?? '',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.9),
                        letterSpacing: 0.2,
                      ),
                    ),
                    if (user?.isVerified == true) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.3),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.verified, size: 16, color: Colors.white),
                            SizedBox(width: 6),
                            Text(
                              'Verified Account',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
          
          // KYC Verification
          _SettingsSection(
            title: l10n.verificationAndLimits,
            items: [
              // Only show "Complete KYC" if user is not verified
              if (user?.isVerified != true)
                _SettingsItem(
                  icon: Icons.verified_user_outlined,
                  title: l10n.completeKYC,
                  subtitle: l10n.increaseLimitsUnlockFeatures,
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.orange[100],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      l10n.actionRequired,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.orange[900],
                      ),
                    ),
                  ),
                  onTap: () {
                    _showKycDialog(context);
                  },
                ),
              // Show verification status if user is verified
              if (user?.isVerified == true)
                _SettingsItem(
                  icon: Icons.verified_user,
                  title: l10n.completeKYC,
                  subtitle: 'Your KYC is verified',
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green[100],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_circle,
                          size: 12,
                          color: Colors.green[900],
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Verified',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.green[900],
                          ),
                        ),
                      ],
                    ),
                  ),
                  // No onTap - disabled when verified
                ),
              // BVN Verification - show different states based on verification
              if (user?.isVerified != true)
                _SettingsItem(
                  icon: Icons.badge_outlined,
                  title: l10n.bvnVerificationTitle,
                  subtitle: l10n.updateOrVerifyBVN,
                  onTap: () {
                    Navigator.pushNamed(context, '/bvn');
                  },
                ),
              // Show BVN as verified if user is verified
              if (user?.isVerified == true)
                _SettingsItem(
                  icon: Icons.badge,
                  title: l10n.bvnVerificationTitle,
                  subtitle: 'BVN verified',
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green[100],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_circle,
                          size: 12,
                          color: Colors.green[900],
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Verified',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.green[900],
                          ),
                        ),
                      ],
                    ),
                  ),
                  // No onTap - disabled when verified
                ),
            ],
          ),
          
          // Account settings
          _SettingsSection(
            title: l10n.account,
            items: [
              _SettingsItem(
                icon: Icons.person_outlined,
                title: l10n.profile,
                onTap: () {
                  Navigator.pushNamed(context, '/complete-profile');
                },
              ),
              _SettingsItem(
                icon: Icons.lock_outlined,
                title: l10n.changePassword,
                onTap: () {
                  Navigator.pushNamed(context, '/change-password');
                },
              ),
            ],
          ),
          
          // Financial Services
          // _SettingsSection(
          //   title: l10n.financialServices,
          //   items: [
          //     _SettingsItem(
          //       icon: Icons.credit_card_outlined,
          //       title: l10n.myCards,
          //       subtitle: l10n.manageDebitCards,
          //       onTap: () {
          //         Navigator.pushNamed(context, '/cards');
          //       },
          //     ),
          //     // _SettingsItem(
          //     //   icon: Icons.shield_outlined,
          //     //   title: 'Insurance',
          //     //   subtitle: 'Protect your assets',
          //     //   onTap: () {
          //     //     Navigator.pushNamed(context, '/insurance');
          //     //   },
          //     // ),
          //     // _SettingsItem(
          //     //   icon: Icons.card_giftcard_outlined,
          //     //   title: 'Rewards',
          //     //   subtitle: 'View rewards & points',
          //     //   onTap: () {
          //     //     Navigator.pushNamed(context, '/rewards');
          //     //   },
          //     // ),
          //     _SettingsItem(
          //       icon: Icons.eco_outlined,
          //       title: l10n.carbonCredits,
          //       subtitle: l10n.carbonOffsetProgram,
          //       onTap: () {
          //         Navigator.pushNamed(context, '/carbon-credits');
          //       },
          //     ),
          //   ],
          // ),
          
          // const Divider(),
          
          // Appearance
          _SettingsSection(
            title: l10n.appearance,
            items: [
              Consumer<ThemeProvider>(
                builder: (context, themeProvider, child) {
                  return _SettingsSwitchItem(
                    icon: Icons.dark_mode_outlined,
                    title: l10n.darkMode,
                    subtitle: l10n.lightAndDarkTheme,
                    value: themeProvider.isDarkMode,
                    onChanged: (value) {
                      themeProvider.toggleTheme();
                    },
                  );
                },
              ),
              Consumer<LanguageProvider>(
                builder: (context, languageProvider, child) {
                  return _SettingsDropdownItem(
                    icon: Icons.language_outlined,
                    title: l10n.language,
                    subtitle: l10n.appLanguage,
                    value: languageProvider.locale.languageCode,
                    items: [
                      DropdownMenuItem(value: 'en', child: Text(LanguageProvider.languageNames['en']!)),
                      DropdownMenuItem(value: 'ig', child: Text(LanguageProvider.languageNames['ig']!)),
                      DropdownMenuItem(value: 'yo', child: Text(LanguageProvider.languageNames['yo']!)),
                      DropdownMenuItem(value: 'ha', child: Text(LanguageProvider.languageNames['ha']!)),
                    ],
                    onChanged: (String? newValue) {
                      if (newValue != null) {
                        languageProvider.changeLanguage(newValue);
                        final l10n = AppLocalizations.of(context)!;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('${l10n.language}: ${LanguageProvider.languageNames[newValue]}'),
                            backgroundColor: AppTheme.successColor,
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                    },
                  );
                },
              ),
            ],
          ),
          
          // Security settings
          _SettingsSection(
            title: l10n.security,
            items: [
              _SettingsSwitchItem(
                icon: Icons.fingerprint_outlined,
                title: l10n.biometricLogin,
                subtitle: l10n.fingerprintOrFaceID,
                value: _biometricEnabled,
                onChanged: _toggleBiometric,
              ),
              _SettingsItem(
                icon: Icons.pin_outlined,
                title: l10n.transactionPin,
                subtitle: l10n.manageYourPin,
                onTap: () {
                  Navigator.pushNamed(context, '/create-pin');
                },
              ),
            ],
          ),
          
          // Notifications
          _SettingsSection(
            title: l10n.notifications,
            items: [
              _SettingsSwitchItem(
                icon: Icons.notifications_outlined,
                title: l10n.pushNotifications,
                subtitle: l10n.receiveTransactionAlerts,
                value: _notificationsEnabled,
                onChanged: (value) {
                  setState(() {
                    _notificationsEnabled = value;
                  });
                },
              ),
            ],
          ),
          
          // Support
          _SettingsSection(
            title: l10n.supportAndInfo,
            items: [
              _SettingsItem(
                icon: Icons.help_outline,
                title: l10n.faq,
                subtitle: l10n.commonQuestions,
                onTap: () {
                  Navigator.pushNamed(context, '/faq');
                },
              ),
              _SettingsItem(
                icon: Icons.chat_outlined,
                title: l10n.contactSupport,
                subtitle: l10n.getHelpFromUs,
                onTap: () {
                  Navigator.pushNamed(context, '/support');
                },
              ),
              _SettingsItem(
                icon: Icons.cloud_outlined,
                title: l10n.networkStatus,
                subtitle: l10n.serviceStatus,
                onTap: () {
                  Navigator.pushNamed(context, '/network-monitor');
                },
              ),
              _SettingsItem(
                icon: Icons.info_outlined,
                title: 'About ${tenantProvider.appName}',
                subtitle: l10n.appInformation,
                onTap: () {
                  showAboutDialog(
                    context: context,
                    applicationName: tenantProvider.appName,
                    applicationVersion: '1.0.0',
                    applicationLegalese: l10n.secureDigitalBanking,
                    applicationIcon: tenantProvider.logoUrl.isNotEmpty
                        ? Image.network(
                            tenantProvider.logoUrl,
                            height: 48,
                            width: 48,
                            errorBuilder: (context, error, stackTrace) {
                              return Icon(
                                Icons.account_balance,
                                size: 48,
                                color: tenantProvider.primaryColor,
                              );
                            },
                          )
                        : Icon(
                            Icons.account_balance,
                            size: 48,
                            color: tenantProvider.primaryColor,
                          ),
                  );
                },
              ),
            ],
          ),
          
          // Logout
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.errorColor.withValues(alpha: 0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Material(
                color: AppTheme.getCardBackground(context),
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  onTap: _handleLogout,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppTheme.errorColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.logout_rounded,
                            color: AppTheme.errorColor,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          l10n.logout,
                          style: const TextStyle(
                            color: AppTheme.errorColor,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          
          const SizedBox(height: 20),
          
          // App version
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.getBorderColor(context).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 14,
                    color: AppTheme.getTextSecondary(context),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Version 1.0.0',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.getTextSecondary(context),
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 40),
        ],
      ),
        );
      },
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> items;

  const _SettingsSection({
    required this.title,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 12),
            child: Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppTheme.getTextSecondary(context),
                letterSpacing: 0.8,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: AppTheme.getCardBackground(context),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? Colors.black.withValues(alpha: 0.3)
                      : Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                for (int i = 0; i < items.length; i++) ...[
                  items[i],
                  if (i < items.length - 1)
                    Padding(
                      padding: const EdgeInsets.only(left: 68),
                      child: Divider(
                        height: 1,
                        thickness: 1,
                        color: AppTheme.getBorderColor(context).withValues(alpha: 0.3),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;

  const _SettingsItem({
    required this.icon,
    required this.title,
    this.onTap,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        final isDisabled = onTap == null;
        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDisabled
                            ? [
                                AppTheme.getBorderColor(context),
                                AppTheme.getBorderColor(context).withValues(alpha: 0.8),
                              ]
                            : [
                                tenantProvider.primaryColor.withValues(alpha: 0.1),
                                tenantProvider.secondaryColor.withValues(alpha: 0.1),
                              ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      icon,
                      color: isDisabled 
                          ? AppTheme.getTextSecondary(context)
                          : tenantProvider.primaryColor,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: isDisabled 
                                ? AppTheme.getTextSecondary(context)
                                : AppTheme.getTextPrimary(context),
                            letterSpacing: 0.2,
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            subtitle!,
                            style: TextStyle(
                              fontSize: 13,
                              color: AppTheme.getTextSecondary(context),
                              letterSpacing: 0.1,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  trailing ??
                      Icon(
                        Icons.chevron_right_rounded,
                        color: AppTheme.getBorderColor(context),
                        size: 24,
                      ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SettingsSwitchItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingsSwitchItem({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => onChanged(!value),
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          tenantProvider.primaryColor.withValues(alpha: 0.1),
                          tenantProvider.secondaryColor.withValues(alpha: 0.1),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      icon,
                      color: tenantProvider.primaryColor,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.getTextPrimary(context),
                            letterSpacing: 0.2,
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            subtitle!,
                            style: TextStyle(
                              fontSize: 13,
                              color: AppTheme.getTextSecondary(context),
                              letterSpacing: 0.1,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Switch(
                    value: value,
                    onChanged: onChanged,
                    activeThumbColor: tenantProvider.primaryColor,
                    activeTrackColor: tenantProvider.primaryColor.withValues(alpha: 0.5),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SettingsDropdownItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  const _SettingsDropdownItem({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      tenantProvider.primaryColor.withValues(alpha: 0.1),
                      tenantProvider.secondaryColor.withValues(alpha: 0.1),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: tenantProvider.primaryColor,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.getTextPrimary(context),
                        letterSpacing: 0.2,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle!,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.getTextSecondary(context),
                          letterSpacing: 0.1,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: tenantProvider.primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: DropdownButton<String>(
                  value: value,
                  items: items,
                  onChanged: onChanged,
                  underline: const SizedBox(),
                  isDense: true,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: tenantProvider.primaryColor,
                  ),
                  icon: Icon(
                    Icons.arrow_drop_down_rounded,
                    color: tenantProvider.primaryColor,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
