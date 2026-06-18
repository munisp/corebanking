import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/providers/language_provider.dart';
import 'package:mobile_app/l10n/app_localizations.dart';

class LanguageSelectionScreen extends StatelessWidget {
  const LanguageSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.changeLanguage),
        elevation: 0,
      ),
      body: ListView.builder(
        itemCount: LanguageProvider.supportedLocales.length,
        itemBuilder: (context, index) {
          final locale = LanguageProvider.supportedLocales[index];
          final languageCode = locale.languageCode;
          final languageName = LanguageProvider.languageNames[languageCode] ?? languageCode;
          final isSelected = languageProvider.locale.languageCode == languageCode;

          return ListTile(
            leading: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected 
                    ? Theme.of(context).primaryColor.withOpacity(0.1)
                    : Colors.grey.withOpacity(0.1),
              ),
              child: Center(
                child: Text(
                  _getLanguageFlag(languageCode),
                  style: const TextStyle(fontSize: 24),
                ),
              ),
            ),
            title: Text(
              languageName,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? Theme.of(context).primaryColor : null,
              ),
            ),
            trailing: isSelected
                ? Icon(
                    Icons.check_circle,
                    color: Theme.of(context).primaryColor,
                  )
                : null,
            onTap: () async {
              await languageProvider.changeLanguage(languageCode);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('${l10n.language} ${l10n.update.toLowerCase()}d'),
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
          );
        },
      ),
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
