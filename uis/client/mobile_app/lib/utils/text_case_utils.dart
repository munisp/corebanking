// Export functions for easy import
export 'text_case_utils.dart';
// lib/utils/text_case_utils.dart
// Utility functions for text case management in Dart

/// Converts a string to uppercase.
String toUpperCase(String str) => str.toUpperCase();

/// Converts a string to lowercase.
String toLowerCase(String str) => str.toLowerCase();

/// Converts a string to title case (first letter of each word capitalized).
String toTitleCase(String str) {
  return str.replaceAllMapped(
    RegExp(r'\w\S*'),
    (Match match) => match.group(0)![0].toUpperCase() + match.group(0)!.substring(1).toLowerCase(),
  );
}

/// Converts a string to camelCase.
String toCamelCase(String str) {
  final words = str.split(RegExp(r'[-_\s]+'));
  if (words.isEmpty) return '';
  return words.first.toLowerCase() +
      words.skip(1).map((w) => w.isEmpty ? '' : w[0].toUpperCase() + w.substring(1).toLowerCase()).join();
}

/// Converts a string to snake_case.
String toSnakeCase(String str) {
  return str
      .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]}_${m[2]}')
      .replaceAll(RegExp(r'\s+'), '_')
      .toLowerCase();
}

/// Converts a string to kebab-case.
String toKebabCase(String str) {
  return str
      .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]}-${m[2]}')
      .replaceAll(RegExp(r'\s+'), '-')
      .toLowerCase();
}
