import 'package:flutter/material.dart';
import '../services/local_storage_service.dart';
import '../config/app_theme.dart';
import '../models/tenant.dart';
import '../utils/tenant_utils.dart';
import '../utils/theme_extensions.dart';

class ThemeProvider with ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.system;
  TenantConfig? _tenantConfig;

  ThemeMode get themeMode => _themeMode;
  TenantConfig? get tenantConfig => _tenantConfig;

  bool get isDarkMode {
    if (_themeMode == ThemeMode.dark) return true;
    if (_themeMode == ThemeMode.light) return false;
    // For system mode, check the platform brightness
    return WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
  }

  ThemeProvider() {
    _loadThemeMode();
  }

  Future<void> _loadThemeMode() async {
    final themeModeString = await LocalStorageService.getString('themeMode') ?? 'system';
    
    switch (themeModeString) {
      case 'light':
        _themeMode = ThemeMode.light;
        break;
      case 'dark':
        _themeMode = ThemeMode.dark;
        break;
      default:
        _themeMode = ThemeMode.system;
    }
    
    notifyListeners();
  }

  /// Update theme with tenant configuration
  void updateTenantConfig(TenantConfig config) {
    // Only update if the config actually changed
    if (_tenantConfig?.id != config.id || _tenantConfig?.branding.primary_color != config.branding.primary_color) {
      _tenantConfig = config;
      notifyListeners();
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    
    String themeModeString;
    
    switch (mode) {
      case ThemeMode.light:
        themeModeString = 'light';
        break;
      case ThemeMode.dark:
        themeModeString = 'dark';
        break;
      case ThemeMode.system:
        themeModeString = 'system';
        break;
    }
    
    await LocalStorageService.setString('themeMode', themeModeString);
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    if (_themeMode == ThemeMode.light) {
      await setThemeMode(ThemeMode.dark);
    } else {
      await setThemeMode(ThemeMode.light);
    }
  }

  // Light theme data with tenant branding
  ThemeData get lightTheme {
    if (_tenantConfig != null) {
      return _buildThemeFromTenant(_tenantConfig!, Brightness.light);
    }
    return AppTheme.lightTheme;
  }

  // Dark theme data with tenant branding
  ThemeData get darkTheme {
    if (_tenantConfig != null) {
      return _buildThemeFromTenant(_tenantConfig!, Brightness.dark);
    }
    return AppTheme.darkTheme;
  }

  /// Build theme from tenant configuration
  ThemeData _buildThemeFromTenant(TenantConfig config, Brightness brightness) {
    final branding = config.branding;
    
    // Parse colors
    final primaryColor = TenantUtils.parseColor(branding.primary_color);
    final secondaryColor = TenantUtils.parseColor(branding.secondary_color);
    final accentColor = TenantUtils.parseColor(branding.accentColor ?? branding.secondary_color);
    final errorColor = TenantUtils.parseColor(branding.errorColor ?? '#D32F2F');
    final warningColor = TenantUtils.parseColor(branding.warningColor ?? '#FFA726');
    final successColor = TenantUtils.parseColor(branding.successColor ?? '#66BB6A');
    final backgroundColor = TenantUtils.parseColor(branding.backgroundColor);
    final surfaceColor = TenantUtils.parseColor(branding.surfaceColor);
    final textPrimaryColor = TenantUtils.parseColor(branding.textPrimaryColor);
    final textSecondaryColor = TenantUtils.parseColor(branding.textSecondaryColor);

    // Use colors directly without any filters or fading
    final adjustedPrimaryColor = primaryColor;
    final adjustedSecondaryColor = secondaryColor;
    final adjustedErrorColor = errorColor;
    final adjustedWarningColor = warningColor;
    final adjustedSuccessColor = successColor;
    final adjustedBackgroundColor = brightness == Brightness.dark
        ? const Color(0xFF121212)
        : backgroundColor;
    final adjustedSurfaceColor = brightness == Brightness.dark
        ? const Color(0xFF1E1E1E)
        : surfaceColor;
    final adjustedTextPrimary =
        brightness == Brightness.dark ? Colors.white : textPrimaryColor;
    final adjustedTextSecondary =
        brightness == Brightness.dark ? Colors.white : textSecondaryColor;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      primaryColor: adjustedPrimaryColor,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: adjustedPrimaryColor,
        onPrimary: TenantUtils.getContrastingTextColor(adjustedPrimaryColor),
        secondary: adjustedSecondaryColor,
        onSecondary: TenantUtils.getContrastingTextColor(adjustedSecondaryColor),
        tertiary: accentColor,
        onTertiary: TenantUtils.getContrastingTextColor(accentColor),
        error: adjustedErrorColor,
        onError: TenantUtils.getContrastingTextColor(adjustedErrorColor),
        surface: adjustedSurfaceColor,
        onSurface: adjustedTextPrimary,
      ),
      extensions: <ThemeExtension<dynamic>>{
        // Custom theme extensions for success and warning colors
        CustomColors(
          success: adjustedSuccessColor,
          warning: adjustedWarningColor,
        ),
      },
      scaffoldBackgroundColor: adjustedBackgroundColor,
      iconTheme: IconThemeData(
        color: brightness == Brightness.dark ? Colors.white : textPrimaryColor,
      ),
      fontFamily: branding.fontFamily,
      textTheme: TextTheme(
        displayLarge: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        displayMedium: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        displaySmall: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        headlineLarge: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        headlineMedium: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        headlineSmall: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        titleLarge: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        titleMedium: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        titleSmall: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        bodyLarge: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        bodyMedium: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        bodySmall: TextStyle(color: adjustedTextSecondary, fontFamily: branding.fontFamily),
        labelLarge: TextStyle(color: adjustedTextPrimary, fontFamily: branding.fontFamily),
        labelMedium: TextStyle(color: adjustedTextSecondary, fontFamily: branding.fontFamily),
        labelSmall: TextStyle(color: adjustedTextSecondary, fontFamily: branding.fontFamily),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: brightness == Brightness.dark
            ? adjustedSurfaceColor
            : adjustedPrimaryColor,
        foregroundColor: brightness == Brightness.dark
            ? adjustedTextPrimary
            : TenantUtils.getContrastingTextColor(adjustedPrimaryColor),
        iconTheme: IconThemeData(
          color: brightness == Brightness.dark
              ? adjustedTextPrimary
              : TenantUtils.getContrastingTextColor(adjustedPrimaryColor),
        ),
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: adjustedPrimaryColor,
          foregroundColor: TenantUtils.getContrastingTextColor(adjustedPrimaryColor),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(branding.borderRadius),
          ),
          minimumSize: const Size(double.infinity, 56),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: adjustedPrimaryColor,
          side: BorderSide(color: adjustedPrimaryColor),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(branding.borderRadius),
          ),
          minimumSize: const Size(double.infinity, 56),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: adjustedPrimaryColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(branding.borderRadius),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: brightness == Brightness.dark
            ? const Color(0xFF2C2C2C)
            : adjustedSurfaceColor,
        labelStyle: TextStyle(color: adjustedTextSecondary),
        hintStyle: TextStyle(
          color: brightness == Brightness.dark
              ? AppTheme.textHintDark
              : adjustedTextSecondary.withOpacity(0.6),
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(branding.borderRadius),
          borderSide: brightness == Brightness.dark
              ? const BorderSide(color: Color(0xFF404040), width: 1)
              : BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(branding.borderRadius),
          borderSide: brightness == Brightness.dark
              ? const BorderSide(color: Color(0xFF404040), width: 1)
              : BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(branding.borderRadius),
          borderSide: BorderSide(color: adjustedPrimaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(branding.borderRadius),
          borderSide: BorderSide(color: adjustedErrorColor),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: brightness == Brightness.dark ? 0 : 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(branding.borderRadius),
          side: brightness == Brightness.dark
              ? const BorderSide(color: Color(0xFF404040), width: 1)
              : BorderSide.none,
        ),
        color: adjustedSurfaceColor,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: adjustedPrimaryColor,
        foregroundColor: TenantUtils.getContrastingTextColor(adjustedPrimaryColor),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: adjustedSurfaceColor,
        selectedItemColor: adjustedPrimaryColor,
        unselectedItemColor: adjustedTextSecondary,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: adjustedSurfaceColor,
        selectedColor: adjustedPrimaryColor,
        labelStyle: TextStyle(color: adjustedTextPrimary),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(branding.borderRadius / 2),
        ),
      ),
      dividerColor: brightness == Brightness.dark
          ? const Color(0xFF404040)
          : adjustedTextSecondary.withOpacity(0.3),
    );
  }
}
