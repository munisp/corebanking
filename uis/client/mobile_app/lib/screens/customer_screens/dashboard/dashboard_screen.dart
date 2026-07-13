import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../l10n/app_localizations.dart';
import '../../../config/app_theme.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/wallet_provider.dart';
import '../../../providers/tenant_provider.dart';
import '../../../models/transaction.dart';
import '../../../services/api_service.dart';
import '../../../config/app_config.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _detailsVisible = true;
  final _apiService = ApiService();
  Map<String, dynamic>? _accountData;
  bool _isLoadingAccount = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  /// Load account data from localStorage/SharedPreferences
  Future<void> _loadAccountFromStorage() async {
    try {
      String? accountJson;
      
      if (kIsWeb) {
        try {
          accountJson = html.window.localStorage['account'];
        } catch (_) {}
      } else {
        try {
          final prefs = await SharedPreferences.getInstance();
          accountJson = prefs.getString('account');
        } catch (_) {}
      }
      
      if (accountJson != null && accountJson.isNotEmpty) {
        setState(() {
          _accountData = jsonDecode(accountJson!);
          _isLoadingAccount = false;
        });
        debugPrint('[Dashboard] Loaded account from storage: ${_accountData?['id']}');
      } else {
        setState(() {
          _isLoadingAccount = false;
        });
        debugPrint('[Dashboard] No account found in storage');
      }
    } catch (e) {
      debugPrint('[Dashboard] Failed to load account from storage: $e');
      setState(() {
        _isLoadingAccount = false;
      });
    }
  }

  /// Fetch account from account endpoint and update localStorage/SharedPreferences
  /// This is called every time dashboard loads or refreshes
  /// Matches web app: ${AppConfig.accountEndpoint}/account/keycloak/${keycloak_id}
  Future<void> _fetchAndStoreAccount() async {
    try {
      debugPrint('[Dashboard] Fetching account from account endpoint...');
      
      // Get keycloak_id from storage
      String? keycloakId;
      if (kIsWeb) {
        try {
          keycloakId = html.window.localStorage['keycloak_id'];
        } catch (_) {}
      } else {
        try {
          final prefs = await SharedPreferences.getInstance();
          keycloakId = prefs.getString('keycloak_id');
        } catch (_) {}
      }
      
      if (keycloakId == null || keycloakId.isEmpty) {
        debugPrint('[Dashboard] No keycloak_id found in storage, skipping account fetch');
        return;
      }
      
      debugPrint('[Dashboard] Calling account endpoint with keycloak_id: $keycloakId');
      
      // Call account endpoint directly (matching web app: ${AppConfig.accountEndpoint}/account/keycloak/${keycloak_id})
      final response = await _apiService.get('${AppConfig.accountEndpoint}/keycloak/$keycloakId');
      debugPrint('[Dashboard] Account endpoint response: ${response.data}');
      
      if (response.data['success'] == true || response.statusCode == 200) {
        final accountData = response.data['account'] as Map<String, dynamic>?;
        
        if (accountData != null) {
          debugPrint('[Dashboard] Account data received, storing to localStorage/SharedPreferences...');
          
          // Store account data (matching web app: localStorage.setItem('account', data) and localStorage.setItem('account_id', data.id))
          try {
            if (kIsWeb) {
              html.window.localStorage['account'] = jsonEncode(accountData);
              if (accountData['id'] != null) {
                html.window.localStorage['account_id'] = accountData['id'].toString();
                html.window.localStorage['user'] = jsonEncode({'account_id': accountData['id']});
              }
              debugPrint('[Dashboard] Account stored to localStorage: ${accountData['id']}');
            } else {
              final prefs = await SharedPreferences.getInstance();
              await prefs.setString('account', jsonEncode(accountData));
              if (accountData['id'] != null) {
                await prefs.setString('account_id', accountData['id'].toString());
                await prefs.setString('user', jsonEncode({'account_id': accountData['id']}));
              }
              debugPrint('[Dashboard] Account stored to SharedPreferences: ${accountData['id']}');
            }
            
            // Update local state with new account data
            setState(() {
              _accountData = accountData;
              _isLoadingAccount = false;
            });
          } catch (e) {
            debugPrint('[Dashboard] Failed to store account data: $e');
          }
        } else {
          debugPrint('[Dashboard] No account data in response');
        }
      } else {
        debugPrint('[Dashboard] Account endpoint returned unsuccessful response');
      }
    } catch (e) {
      debugPrint('[Dashboard] Failed to fetch account on dashboard load: $e');
      // Don't throw - continue even if account fetch fails
    }
  }

  Future<void> _loadData() async {
    // Match web app: load account from storage first, then fetch fresh data
    await _loadAccountFromStorage();
    
    final authProvider = context.read<AuthProvider>();
    final walletProvider = context.read<WalletProvider>();
    
    // Fetch account endpoint first - this updates localStorage with account and account_id
    await _fetchAndStoreAccount();
    
    // Load wallet (which also stores account as backup)
    await walletProvider.fetchWallet();
    
    // Then load user profile and transactions in parallel
    await Future.wait([
      authProvider.fetchUserProfile(),
      walletProvider.fetchTransactions(refresh: true),
    ]);
  }

  Future<void> _handleRefresh() async {
    // Match web app: fetch account first (to update localStorage), then refresh wallet, user and transactions
    setState(() {
      _isLoadingAccount = true;
    });
    
    // Fetch account endpoint first - this updates localStorage with account and account_id
    await _fetchAndStoreAccount();
    
    final walletProvider = context.read<WalletProvider>();
    
    // Refresh wallet (which also stores account as backup)
    await walletProvider.refreshAll();
    
    // Then refresh user profile
    await context.read<AuthProvider>().fetchUserProfile();
  }

  String _formatBalance(dynamic balance) {
    if (balance == null) return '₦0.00';
    
    try {
      double amount;
      if (balance is String) {
        amount = double.tryParse(balance) ?? 0.0;
      } else if (balance is num) {
        amount = balance.toDouble();
      } else {
        return '₦0.00';
      }
      
      final formatter = NumberFormat.currency(
        symbol: '₦',
        decimalDigits: 2,
      );
      return formatter.format(amount);
    } catch (e) {
      debugPrint('[Dashboard] Error formatting balance: $e');
      return '₦0.00';
    }
  }

  Future<void> _handleKycVerification(BuildContext context, dynamic user) async {
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
            const SnackBar(
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
    } else {
      // If no kyc_verification_url, navigate to internal KYC flow
      Navigator.pushNamed(
        context,
        '/kyc-documents',
        arguments: {'isKycCompletion': true},
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final walletProvider = context.watch<WalletProvider>();
    final user = authProvider.currentUser;
    final l10n = AppLocalizations.of(context)!;

    // Use account data from local storage instead of wallet
    final balance = _accountData?['balance'];
    final accountNumber = _accountData?['account_number']?.toString() ?? _accountData?['accountNumber']?.toString();
    final accountId = _accountData?['id']?.toString();
    final loading = _isLoadingAccount;

    return Scaffold(
          body: NestedScrollView(
            headerSliverBuilder: (context, innerBoxIsScrolled) {
              return [
                // Fixed Top Bar
                SliverAppBar(
                  pinned: true,
                  floating: false,
                  automaticallyImplyLeading: false,
                  backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                  elevation: 0,
                  expandedHeight: 0,
                  toolbarHeight: 72,
                  flexibleSpace: SafeArea(
                    child: Container(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      child: Row(
                        children: [
                          Consumer<TenantProvider>(
                            builder: (context, tenantProvider, _) {
                              return Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      tenantProvider.primaryColor.withValues(alpha: 0.15),
                                      tenantProvider.secondaryColor.withValues(alpha: 0.15),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: tenantProvider.primaryColor.withValues(alpha: 0.2),
                                    width: 1.5,
                                  ),
                                ),
                                child: CircleAvatar(
                                  radius: 22,
                                  backgroundColor: Colors.transparent,
                                  child: Icon(
                                    Icons.person_rounded,
                                    size: 26,
                                    color: tenantProvider.primaryColor,
                                  ),
                                ),
                              );
                            },
                          ),
                          const SizedBox(width: 14),
                          // User greeting
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  _getGreeting(),
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: AppTheme.getTextSecondary(context),
                                    letterSpacing: 0.2,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  user?.fullName ?? l10n.user,
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.getTextPrimary(context),
                                    letterSpacing: 0.3,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Action buttons
                          Consumer<TenantProvider>(
                            builder: (context, tenantProvider, _) {
                              return Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      tenantProvider.primaryColor.withValues(alpha: 0.1),
                                      tenantProvider.secondaryColor.withValues(alpha: 0.1),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: tenantProvider.primaryColor.withValues(alpha: 0.15),
                                    width: 1,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: tenantProvider.primaryColor.withValues(alpha: 0.08),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: PopupMenuButton<String>(
                                  icon: Icon(Icons.more_vert,
                                      size: 21, color: tenantProvider.primaryColor),
                                  padding: const EdgeInsets.all(9),
                                  constraints: const BoxConstraints(),
                                  color: Theme.of(context).cardColor,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  onSelected: (value) {
                                    Navigator.pushNamed(context, '/$value');
                                  },
                                  itemBuilder: (context) => [
                                    PopupMenuItem(
                                      value: 'notifications',
                                      child: Row(
                                        children: [
                                          Icon(Icons.notifications_outlined,
                                              size: 20,
                                              color: tenantProvider.primaryColor),
                                          const SizedBox(width: 12),
                                          const Text('Notifications'),
                                        ],
                                      ),
                                    ),
                                    PopupMenuItem(
                                      value: 'settings',
                                      child: Row(
                                        children: [
                                          Icon(Icons.settings_outlined,
                                              size: 20,
                                              color: tenantProvider.primaryColor),
                                          const SizedBox(width: 12),
                                          const Text('Settings'),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ];
            },
            body: SafeArea(
              top: false,
              child: RefreshIndicator(
                onRefresh: _handleRefresh,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    // Balance Card (matching web app exactly - using account data from localStorage)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                        child: Consumer<TenantProvider>(
                          builder: (context, tenantProvider, _) {
                            return Container(
                              width: double.infinity,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    _parseColor(tenantProvider.tenantConfig.branding.primary_color),
                                    _parseColor(tenantProvider.tenantConfig.branding.secondary_color),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(
                                    color: _parseColor(tenantProvider.tenantConfig.branding.primary_color).withValues(alpha: 0.3),
                                    blurRadius: 20,
                                    offset: const Offset(0, 8),
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                              child: Stack(
                                children: [
                                  // Decorative circles
                                  Positioned(
                                    top: -30,
                                    right: -30,
                                    child: Container(
                                      width: 120,
                                      height: 120,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.white.withValues(alpha: 0.08),
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    bottom: -20,
                                    left: -20,
                                    child: Container(
                                      width: 80,
                                      height: 80,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: Colors.white.withValues(alpha: 0.06),
                                      ),
                                    ),
                                  ),
                                  // Content
                                  Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              l10n.availableBalance,
                                              style: TextStyle(
                                                color: Colors.white.withValues(alpha: 0.9),
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                            Container(
                                              decoration: BoxDecoration(
                                                color: Colors.white.withValues(alpha: 0.2),
                                                borderRadius: BorderRadius.circular(10),
                                                border: Border.all(
                                                  color: Colors.white.withValues(alpha: 0.3),
                                                  width: 1,
                                                ),
                                              ),
                                              child: Material(
                                                color: Colors.transparent,
                                                child: InkWell(
                                                  onTap: () {
                                                    setState(() {
                                                      _detailsVisible = !_detailsVisible;
                                                    });
                                                  },
                                                  borderRadius: BorderRadius.circular(10),
                                                  child: Padding(
                                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                                    child: Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        Icon(
                                                          _detailsVisible ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                                          size: 14,
                                                          color: Colors.white,
                                                        ),
                                                        const SizedBox(width: 6),
                                                        Text(
                                                          _detailsVisible ? l10n.hide : l10n.show,
                                                          style: const TextStyle(
                                                            color: Colors.white,
                                                            fontSize: 12,
                                                            fontWeight: FontWeight.w600,
                                                            letterSpacing: 0.3,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 16),
                                        Text(
                                          loading
                                              ? '...'
                                              : (_detailsVisible
                                                  ? _formatBalance(balance)
                                                  : '₦****.**'),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 38,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 1,
                                            height: 1.2,
                                          ),
                                        ),
                                        const SizedBox(height: 20),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 14, vertical: 10),
                                          decoration: BoxDecoration(
                                            color: Colors.white.withValues(alpha: 0.18),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(
                                              color: Colors.white.withValues(alpha: 0.25),
                                              width: 1,
                                            ),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(
                                                Icons.credit_card_rounded,
                                                color: Colors.white,
                                                size: 16,
                                              ),
                                              const SizedBox(width: 10),
                                              Text(
                                                _detailsVisible
                                                    ? (accountNumber != null && accountId != null
                                                        ? '$accountNumber • $accountId'
                                                        : accountNumber ?? accountId ?? '**********')
                                                    : '**********',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w600,
                                                  letterSpacing: 0.8,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ),

                    // KYC Verification Banner (if user is not verified)
                    if (user?.isVerified != true)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: () => _handleKycVerification(context, user),
                              borderRadius: BorderRadius.circular(16),
                              child: Builder(
                              builder: (context) {
                                final isDark = Theme.of(context).brightness == Brightness.dark;
                                return Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: isDark
                                          ? [const Color(0xFF3D2800), const Color(0xFF4D3000)]
                                          : [Colors.orange[50]!, Colors.orange[100]!],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: isDark ? const Color(0xFF7A4500) : Colors.orange[300]!,
                                      width: 1.5,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.orange.withValues(alpha: isDark ? 0.1 : 0.2),
                                        blurRadius: 8,
                                        offset: const Offset(0, 3),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: isDark ? const Color(0xFF5C3800) : Colors.orange[200],
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Icon(
                                          Icons.warning_amber_rounded,
                                          color: isDark ? Colors.orange[300] : Colors.orange[900],
                                          size: 28,
                                        ),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Account Not Verified',
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w700,
                                                color: isDark ? Colors.orange[200] : Colors.orange[900],
                                                letterSpacing: 0.2,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              'Complete KYC to unlock all features',
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: isDark ? Colors.orange[300] : Colors.orange[800],
                                                height: 1.3,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Icon(
                                        Icons.arrow_forward_ios_rounded,
                                        color: isDark ? Colors.orange[300] : Colors.orange[700],
                                        size: 18,
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                            ),
                          ),
                        ),
                      ),

                    // Quick Actions
                    if (user?.isVerified == true)
                      SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16.0, vertical: 28.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Consumer<TenantProvider>(
                              builder: (context, tenantProvider, _) {
                                return Row(
                                  children: [
                                    Container(
                                      width: 4,
                                      height: 24,
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [
                                            tenantProvider.primaryColor,
                                            tenantProvider.secondaryColor,
                                          ],
                                          begin: Alignment.topCenter,
                                          end: Alignment.bottomCenter,
                                        ),
                                        borderRadius: BorderRadius.circular(2),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      l10n.quickActions,
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.getTextPrimary(context),
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                  ],
                                );
                              },
                            ),
                            const SizedBox(height: 20),
                            // Quick action buttons grid (matching web app)
                            GridView.count(
                              crossAxisCount: 4,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              mainAxisSpacing: 14,
                              crossAxisSpacing: 14,
                              children: [
                                _buildQuickActionButton(
                                  icon: Icons.send_rounded,
                                  label: l10n.transfer,
                                  onTap: () => Navigator.pushNamed(context, '/transfer'),
                                ),
                                _buildQuickActionButton(
                                  icon: Icons.trending_up_rounded,
                                  label: l10n.loans,
                                  onTap: () => Navigator.pushNamed(context, '/active-loans'),
                                ),
                                _buildQuickActionButton(
                                  icon: Icons.mic_rounded,
                                  label: l10n.voiceBanking,
                                  onTap: () => Navigator.pushNamed(context, '/voice-assistant'),
                                ),
                                _buildQuickActionButton(
                                  icon: Icons.flash_on_outlined,
                                  label: l10n.moreActions,
                                  onTap: () => Navigator.pushNamed(context, '/more-actions'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Recent Transactions
                    if (user?.isVerified == true)
                      SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              l10n.recentTransactions,
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.getTextPrimary(context),
                              ),
                            ),
                            TextButton(
                              onPressed: () {
                                Navigator.pushNamed(
                                    context, '/transaction-history');
                              },
                              child: Consumer<TenantProvider>(
                                builder: (context, tenantProvider, _) {
                                  return Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        l10n.seeAll,
                                        style: TextStyle(
                                          color: tenantProvider.primaryColor,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(
                                        Icons.chevron_right,
                                        size: 16,
                                        color: tenantProvider.primaryColor,
                                      ),
                                    ],
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SliverToBoxAdapter(child: SizedBox(height: 16)),

                    // Transaction List
                    if (walletProvider.isLoadingTransactions)
                      const SliverFillRemaining(
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (walletProvider.transactions.isEmpty)
                      SliverFillRemaining(
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.receipt_long_outlined,
                                size: 80,
                                color: AppTheme.getTextSecondary(context),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'No transactions yet',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppTheme.getTextPrimary(context),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              Text(
                                'Your transaction history will appear here',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppTheme.getTextSecondary(context),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final transaction =
                                walletProvider.transactions[index];
                            return Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16.0, vertical: 8.0),
                              child: _buildTransactionCard(transaction),
                            );
                          },
                          childCount: walletProvider.transactions.length > 5
                              ? 5
                              : walletProvider.transactions.length,
                        ),
                      ),
                    const SliverToBoxAdapter(child: SizedBox(height: 150)),
                  ],
                ),
              ),
            ),
          ),
        );
  }

  Widget _buildQuickActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2A2A) : null,
                gradient: isDark
                    ? null
                    : LinearGradient(
                        colors: [
                          tenantProvider.primaryColor.withValues(alpha: 0.1),
                          tenantProvider.secondaryColor.withValues(alpha: 0.1),
                        ],
                      ),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isDark
                      ? tenantProvider.primaryColor.withValues(alpha: 0.4)
                      : tenantProvider.primaryColor.withValues(alpha: 0.15),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: tenantProvider.primaryColor.withValues(alpha: isDark ? 0.15 : 0.08),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    color: isDark
                        ? tenantProvider.primaryColor.withValues(alpha: 1.0)
                        : tenantProvider.primaryColor,
                    size: 28,
                  ),
                  const SizedBox(height: 8),
                  Flexible(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.getTextPrimary(context),
                          letterSpacing: 0.2,
                        ),
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildTransactionCard(Transaction transaction) {
    return Consumer<TenantProvider>(
      builder: (context, tenantProvider, _) {
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: AppTheme.getCardBackground(context),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppTheme.getBorderColor(context).withValues(alpha: 0.5),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: AppTheme.getBorderColor(context).withValues(alpha: 0.08),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                // Navigate to transaction details
              },
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: transaction.isCredit
                              ? [
                                  Colors.green.withValues(alpha: 0.12),
                                  Colors.green.withValues(alpha: 0.08),
                                ]
                              : [
                                  Colors.red.withValues(alpha: 0.12),
                                  Colors.red.withValues(alpha: 0.08),
                                ],
                        ),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: transaction.isCredit
                              ? Colors.green.withValues(alpha: 0.2)
                              : Colors.red.withValues(alpha: 0.2),
                          width: 1,
                        ),
                      ),
                      child: Builder(
                        builder: (context) {
                          final isDark = Theme.of(context).brightness == Brightness.dark;
                          return Icon(
                            transaction.isCredit
                                ? Icons.arrow_downward_rounded
                                : Icons.arrow_upward_rounded,
                            color: transaction.isCredit
                                ? (isDark ? Colors.green.shade400 : Colors.green.shade700)
                                : (isDark ? Colors.red.shade400 : Colors.red.shade700),
                            size: 24,
                          );
                        },
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            transaction.displayTitle ?? transaction.description ?? 'Transaction',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.getTextPrimary(context),
                              letterSpacing: 0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 5),
                          Text(
                            transaction.category ?? _formatDate(transaction.createdAt),
                            style: TextStyle(
                              fontSize: 12,
                              color: AppTheme.getTextSecondary(context),
                              letterSpacing: 0.1,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Builder(
                          builder: (context) {
                            final isDark = Theme.of(context).brightness == Brightness.dark;
                            return Text(
                              transaction.formattedAmount,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: transaction.isCredit
                                    ? (isDark ? Colors.green.shade400 : Colors.green.shade700)
                                    : AppTheme.getTextPrimary(context),
                                letterSpacing: 0.3,
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.getBorderColor(context).withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _formatDate(transaction.createdAt),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: AppTheme.getTextSecondary(context),
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date).inDays;
    
    if (difference == 0) {
      return DateFormat('HH:mm').format(date);
    } else if (difference == 1) {
      return 'Yesterday';
    } else if (difference < 7) {
      return DateFormat('EEE').format(date);
    } else {
      return DateFormat('MMM d').format(date);
    }
  }

  String _getGreeting() {
    final l10n = AppLocalizations.of(context)!;
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return l10n.goodMorning;
    } else if (hour < 17) {
      return l10n.goodAfternoon;
    } else {
      return l10n.goodEvening;
    }
  }

  Color _parseColor(String colorString) {
    try {
      return Color(int.parse(colorString.replaceFirst('#', '0xFF')));
    } catch (e) {
      // Fallback to tenant primary color if available
      final tenantProvider = Provider.of<TenantProvider>(context, listen: false);
      return tenantProvider.primaryColor;
    }
  }
}