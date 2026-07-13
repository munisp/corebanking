import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// A custom localization delegate that provides English Material localizations
/// for African languages (Igbo, Yoruba, Hausa) that don't have official
/// Material widget translations from Flutter.
class FallbackMaterialLocalizationsDelegate
    extends LocalizationsDelegate<MaterialLocalizations> {
  const FallbackMaterialLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    // Support African languages that don't have Material translations
    return locale.languageCode == 'ig' ||
        locale.languageCode == 'yo' ||
        locale.languageCode == 'ha';
  }

  @override
  Future<MaterialLocalizations> load(Locale locale) async {
    // Return English Material localizations for unsupported languages
    return SynchronousFuture<MaterialLocalizations>(
      await GlobalMaterialLocalizations.delegate.load(const Locale('en')),
    );
  }

  @override
  bool shouldReload(FallbackMaterialLocalizationsDelegate old) => false;
}
