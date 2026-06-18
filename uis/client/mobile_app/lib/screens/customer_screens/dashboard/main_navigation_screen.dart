import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../config/app_theme.dart';
import '../../../providers/tenant_provider.dart';
import '../../../l10n/app_localizations.dart';
import '../../../widgets/glass_bottom_navigation_bar.dart';
import 'dashboard_screen.dart';
import '../transaction/transaction_history.dart';
import '../savings/savings_list_screen.dart';
import '../settings/settings_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  DateTime? _lastPressedAt;

  final List<Widget> _screens = const [
    DashboardScreen(),
    TransactionHistoryScreen(),
    SavingsListScreen(),
    SettingsScreen(),
  ];

  Future<bool> _onWillPop() async {
    // If not on home tab, go to home tab instead of exiting
    if (_currentIndex != 0) {
      setState(() {
        _currentIndex = 0;
      });
      return false;
    }

    // Double back press to exit
    final now = DateTime.now();
    final backButtonHasNotBeenPressedOrSnackBarHasBeenClosed =
        _lastPressedAt == null ||
            now.difference(_lastPressedAt!) > const Duration(seconds: 2);

    if (backButtonHasNotBeenPressedOrSnackBarHasBeenClosed) {
      _lastPressedAt = now;
      final l10n = AppLocalizations.of(context)!;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.back),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return false;
    }

    SystemNavigator.pop();
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        extendBody: true, // Allow content to extend behind bottom nav
        backgroundColor: isDarkMode 
            ? const Color(0xFF121212)
            : AppTheme.backgroundColor,
        body: IndexedStack(
          index: _currentIndex,
          children: _screens,
        ),
        bottomNavigationBar: Consumer<TenantProvider>(
          builder: (context, tenantProvider, _) {
            final l10n = AppLocalizations.of(context)!;
            return GlassBottomNavigationBar(
              currentIndex: _currentIndex,
              onTap: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
              primaryColor: tenantProvider.primaryColor,
              backgroundColor: isDarkMode
                  ? const Color(0xFF1E1E1E)
                  : AppTheme.surfaceColor,
              isDarkMode: isDarkMode,
              items: [
                GlassBottomNavigationItem(
                  icon: Icons.home_outlined,
                  activeIcon: Icons.home,
                  label: l10n.home,
                ),
                GlassBottomNavigationItem(
                  icon: Icons.receipt_long_outlined,
                  activeIcon: Icons.receipt_long,
                  label: l10n.transactions,
                ),
                GlassBottomNavigationItem(
                  icon: Icons.savings_outlined,
                  activeIcon: Icons.savings,
                  label: l10n.savings,
                ),
                GlassBottomNavigationItem(
                  icon: Icons.settings_outlined,
                  activeIcon: Icons.settings,
                  label: l10n.settings,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
