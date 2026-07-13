import '../utils/text_case_utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/language_provider.dart';

/// Compact language switcher button for auth pages
/// Shows a dropdown with available languages
class LanguageSwitcherButton extends StatelessWidget {
  final bool isDark;
  
  const LanguageSwitcherButton({
    super.key,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final currentLanguageCode = languageProvider.locale.languageCode;

    return PopupMenuButton<String>(
      tooltip: 'Change Language',
      icon: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isDark 
                ? Colors.white.withOpacity(0.3)
                : Colors.black.withOpacity(0.2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.language,
              size: 18,
              color: isDark ? Colors.white : Colors.black87,
            ),
            const SizedBox(width: 6),
            Text(
              _getLanguageFlag(currentLanguageCode),
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(width: 4),
            Text(
              toUpperCase(currentLanguageCode),
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.arrow_drop_down,
              size: 18,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ],
        ),
      ),
      onSelected: (String languageCode) async {
        await languageProvider.changeLanguage(languageCode);
        if (context.mounted) {
          final languageName = LanguageProvider.languageNames[languageCode] ?? languageCode;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('Language changed to $languageName'),
                  ),
                ],
              ),
              backgroundColor: Colors.green,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 2),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          );
        }
      },
      itemBuilder: (BuildContext context) {
        return LanguageProvider.supportedLocales.map((Locale locale) {
          final languageCode = locale.languageCode;
          final languageName = LanguageProvider.languageNames[languageCode] ?? languageCode;
          final isSelected = currentLanguageCode == languageCode;

          return PopupMenuItem<String>(
            value: languageCode,
            child: Row(
              children: [
                Text(
                  _getLanguageFlag(languageCode),
                  style: const TextStyle(fontSize: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    languageName,
                    style: TextStyle(
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      color: isSelected ? Theme.of(context).primaryColor : null,
                    ),
                  ),
                ),
                if (isSelected)
                  Icon(
                    Icons.check_circle,
                    color: Theme.of(context).primaryColor,
                    size: 20,
                  ),
              ],
            ),
          );
        }).toList();
      },
    );
  }

  String _getLanguageFlag(String languageCode) {
    switch (languageCode) {
      case 'en':
        return '🇬🇧'; // English flag
      case 'ig':
        return '🇳🇬'; // Nigeria flag for Igbo
      case 'yo':
        return '🇳🇬'; // Nigeria flag for Yoruba
      case 'ha':
        return '🇳🇬'; // Nigeria flag for Hausa
      default:
        return '🌐';
    }
  }
}
