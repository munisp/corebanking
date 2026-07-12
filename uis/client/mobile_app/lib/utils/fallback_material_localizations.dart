import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Custom Material localizations delegate that provides fallback
/// for unsupported locales (Yoruba, Igbo, Hausa)
class FallbackMaterialLocalizationsDelegate
    extends LocalizationsDelegate<MaterialLocalizations> {
  const FallbackMaterialLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    // Support Nigerian languages by falling back to English
    return ['en', 'yo', 'ig', 'ha'].contains(locale.languageCode);
  }

  @override
  Future<MaterialLocalizations> load(Locale locale) async {
    // For Nigerian languages, use English Material localizations
    if (['yo', 'ig', 'ha'].contains(locale.languageCode)) {
      return SynchronousFuture<MaterialLocalizations>(
        await GlobalMaterialLocalizations.delegate.load(const Locale('en')),
      );
    }
    // For other locales, use the default
    return SynchronousFuture<MaterialLocalizations>(
      await GlobalMaterialLocalizations.delegate.load(locale),
    );
  }

  @override
  bool shouldReload(FallbackMaterialLocalizationsDelegate old) => false;
}

/// Custom Cupertino localizations delegate that provides fallback
/// for unsupported locales (Yoruba, Igbo, Hausa)
class FallbackCupertinoLocalizationsDelegate
    extends LocalizationsDelegate<CupertinoLocalizations> {
  const FallbackCupertinoLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    // Support Nigerian languages by falling back to English
    return ['en', 'yo', 'ig', 'ha'].contains(locale.languageCode);
  }

  @override
  Future<CupertinoLocalizations> load(Locale locale) async {
    // For Nigerian languages, use English Cupertino localizations
    if (['yo', 'ig', 'ha'].contains(locale.languageCode)) {
      return SynchronousFuture<CupertinoLocalizations>(
        await GlobalCupertinoLocalizations.delegate.load(const Locale('en')),
      );
    }
    // For other locales, use the default
    return SynchronousFuture<CupertinoLocalizations>(
      await GlobalCupertinoLocalizations.delegate.load(locale),
    );
  }

  @override
  bool shouldReload(FallbackCupertinoLocalizationsDelegate old) => false;
}

/// Custom Widgets localizations delegate that provides fallback
/// for unsupported locales (Yoruba, Igbo, Hausa)
class FallbackWidgetsLocalizationsDelegate
    extends LocalizationsDelegate<WidgetsLocalizations> {
  const FallbackWidgetsLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    // Support Nigerian languages by falling back to English
    return ['en', 'yo', 'ig', 'ha'].contains(locale.languageCode);
  }

  @override
  Future<WidgetsLocalizations> load(Locale locale) async {
    // For Nigerian languages, use English Widgets localizations
    if (['yo', 'ig', 'ha'].contains(locale.languageCode)) {
      return SynchronousFuture<WidgetsLocalizations>(
        await GlobalWidgetsLocalizations.delegate.load(const Locale('en')),
      );
    }
    // For other locales, use the default
    return SynchronousFuture<WidgetsLocalizations>(
      await GlobalWidgetsLocalizations.delegate.load(locale),
    );
  }

  @override
  bool shouldReload(FallbackWidgetsLocalizationsDelegate old) => false;
}
