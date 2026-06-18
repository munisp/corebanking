import 'package:flutter/material.dart';

class AppTheme {
  // Primary Colors
  static const Color primaryColor = Color(0xFF1A73E8);
  static const Color primaryDark = Color(0xFF0D47A1);
  static const Color primaryLight = Color(0xFF64B5F6);
  
  // Secondary Colors
  static const Color secondaryColor = Color(0xFF00C853);
  static const Color secondaryDark = Color(0xFF00A843);
  static const Color secondaryLight = Color(0xFF69F0AE);
  
  // Neutral Colors
  static const Color backgroundColor = Color(0xFFF5F7FA);
  static const Color surfaceColor = Color(0xFFFFFFFF);
  static const Color errorColor = Color(0xFFD32F2F);
  static const Color warningColor = Color(0xFFFFA726);
  static const Color successColor = Color(0xFF66BB6A);
  
  // Light Mode Text Colors
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textHint = Color(0xFFBDBDBD);
  
  // Dark Mode Text Colors
  static const Color textPrimaryDark = Colors.white;
  static const Color textSecondaryDark = Colors.white;
  static const Color textHintDark = Color(0xFFAAAAAA);
  
  // Helper methods to get theme-aware colors
  static Color getTextPrimary(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? textPrimaryDark
        : textPrimary;
  }
  
  static Color getTextSecondary(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? textSecondaryDark
        : textSecondary;
  }
  
  static Color getTextHint(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? textHintDark
        : textHint;
  }
  
  static Color getCardBackground(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF1E1E1E)
        : surfaceColor;
  }
  
  static Color getBorderColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF404040)
        : const Color(0xFFE0E0E0);
  }
  
  // Light Theme
  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: const ColorScheme.light(
      primary: primaryColor,
      secondary: secondaryColor,
      surface: surfaceColor,
      error: errorColor,
      onSurface: textPrimary,
    ),
    scaffoldBackgroundColor: backgroundColor,
    textTheme: const TextTheme(
      displayLarge: TextStyle(color: textPrimary),
      displayMedium: TextStyle(color: textPrimary),
      displaySmall: TextStyle(color: textPrimary),
      headlineLarge: TextStyle(color: textPrimary),
      headlineMedium: TextStyle(color: textPrimary),
      headlineSmall: TextStyle(color: textPrimary),
      titleLarge: TextStyle(color: textPrimary),
      titleMedium: TextStyle(color: textPrimary),
      titleSmall: TextStyle(color: textPrimary),
      bodyLarge: TextStyle(color: textPrimary),
      bodyMedium: TextStyle(color: textPrimary),
      bodySmall: TextStyle(color: textSecondary),
      labelLarge: TextStyle(color: textPrimary),
      labelMedium: TextStyle(color: textSecondary),
      labelSmall: TextStyle(color: textHint),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: surfaceColor,
      elevation: 0,
      iconTheme: IconThemeData(color: textPrimary),
      titleTextStyle: TextStyle(
        color: textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        minimumSize: const Size(double.infinity, 56),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primaryColor,
        side: const BorderSide(color: primaryColor, width: 2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        minimumSize: const Size(double.infinity, 56),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceColor,
      labelStyle: const TextStyle(color: textSecondary),
      hintStyle: TextStyle(color: textHint),
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
        borderSide: const BorderSide(color: primaryColor, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: errorColor),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    cardTheme: CardThemeData(
      color: surfaceColor,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE0E0E0), width: 1),
      ),
    ),
  );
  
  // Dark Theme
  static ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: const ColorScheme.dark(
      primary: primaryLight,
      secondary: secondaryLight,
      surface: Color(0xFF1E1E1E),
      error: errorColor,
      onSurface: textPrimaryDark,
    ),
    scaffoldBackgroundColor: const Color(0xFF121212),
    textTheme: const TextTheme(
      displayLarge: TextStyle(color: textPrimaryDark),
      displayMedium: TextStyle(color: textPrimaryDark),
      displaySmall: TextStyle(color: textPrimaryDark),
      headlineLarge: TextStyle(color: textPrimaryDark),
      headlineMedium: TextStyle(color: textPrimaryDark),
      headlineSmall: TextStyle(color: textPrimaryDark),
      titleLarge: TextStyle(color: textPrimaryDark),
      titleMedium: TextStyle(color: textPrimaryDark),
      titleSmall: TextStyle(color: textPrimaryDark),
      bodyLarge: TextStyle(color: textPrimaryDark),
      bodyMedium: TextStyle(color: textPrimaryDark),
      bodySmall: TextStyle(color: textSecondaryDark),
      labelLarge: TextStyle(color: textPrimaryDark),
      labelMedium: TextStyle(color: textSecondaryDark),
      labelSmall: TextStyle(color: textHintDark),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF1E1E1E),
      elevation: 0,
      iconTheme: IconThemeData(color: Colors.white),
      titleTextStyle: TextStyle(
        color: Colors.white,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryLight,
        foregroundColor: Colors.black,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        minimumSize: const Size(double.infinity, 56),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primaryLight,
        side: const BorderSide(color: primaryLight, width: 2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        minimumSize: const Size(double.infinity, 56),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF2C2C2C),
      labelStyle: const TextStyle(color: textSecondaryDark),
      hintStyle: const TextStyle(color: textHintDark),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF404040)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF404040)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: primaryLight, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: errorColor),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    cardTheme: CardThemeData(
      color: const Color(0xFF1E1E1E),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF404040), width: 1),
      ),
    ),
  );
}
