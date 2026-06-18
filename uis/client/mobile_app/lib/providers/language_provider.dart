import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LanguageProvider extends ChangeNotifier {
  Locale _locale = const Locale('en'); // Default to English
  
  Locale get locale => _locale;

  // Supported locales
  static const List<Locale> supportedLocales = [
    Locale('en'), // English
    Locale('ig'), // Igbo
    Locale('yo'), // Yoruba
    Locale('ha'), // Hausa
  ];

  // Language names for display
  static const Map<String, String> languageNames = {
    'en': 'English',
    'ig': 'Igbo',
    'yo': 'Yoruba',
    'ha': 'Hausa',
  };

  LanguageProvider() {
    _loadSavedLanguage();
  }

  // Load saved language preference
  Future<void> _loadSavedLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final languageCode = prefs.getString('language_code');
      
      if (languageCode != null) {
        _locale = Locale(languageCode);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading language preference: $e');
    }
  }

  // Change language
  Future<void> changeLanguage(String languageCode) async {
    if (_locale.languageCode == languageCode) return;
    
    _locale = Locale(languageCode);
    notifyListeners();
    
    // Save preference
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('language_code', languageCode);
    } catch (e) {
      debugPrint('Error saving language preference: $e');
    }
  }

  // Get language name
  String getLanguageName(String languageCode) {
    return languageNames[languageCode] ?? languageCode;
  }

  // Check if language is supported
  bool isLanguageSupported(String languageCode) {
    return supportedLocales.any((locale) => locale.languageCode == languageCode);
  }
}
