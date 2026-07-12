import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;

/// Centralized local storage service for Android, iOS, and Web
/// Handles storing and retrieving data with proper error handling
class LocalStorageService {
  /// Get a string value from storage
  /// Returns null if the key doesn't exist or if there's an error
  static Future<String?> getString(String key) async {
    try {
      if (kIsWeb) {
        return html.window.localStorage[key];
      } else {
        final prefs = await SharedPreferences.getInstance();
        return prefs.getString(key);
      }
    } catch (e) {
      debugPrint('Error getting string from storage for key "$key": $e');
      return null;
    }
  }

  /// Save a string value to storage
  /// Returns true if successful, false otherwise
  static Future<bool> setString(String key, String value) async {
    try {
      if (kIsWeb) {
        html.window.localStorage[key] = value;
        return true;
      } else {
        final prefs = await SharedPreferences.getInstance();
        return await prefs.setString(key, value);
      }
    } catch (e) {
      debugPrint('Error setting string to storage for key "$key": $e');
      return false;
    }
  }

  /// Get an integer value from storage
  /// Returns null if the key doesn't exist or if there's an error
  static Future<int?> getInt(String key) async {
    try {
      if (kIsWeb) {
        final value = html.window.localStorage[key];
        return value != null ? int.tryParse(value) : null;
      } else {
        final prefs = await SharedPreferences.getInstance();
        return prefs.getInt(key);
      }
    } catch (e) {
      debugPrint('Error getting int from storage for key "$key": $e');
      return null;
    }
  }

  /// Save an integer value to storage
  /// Returns true if successful, false otherwise
  static Future<bool> setInt(String key, int value) async {
    try {
      if (kIsWeb) {
        html.window.localStorage[key] = value.toString();
        return true;
      } else {
        final prefs = await SharedPreferences.getInstance();
        return await prefs.setInt(key, value);
      }
    } catch (e) {
      debugPrint('Error setting int to storage for key "$key": $e');
      return false;
    }
  }

  /// Get a boolean value from storage
  /// Returns null if the key doesn't exist or if there's an error
  static Future<bool?> getBool(String key) async {
    try {
      if (kIsWeb) {
        final value = html.window.localStorage[key];
        if (value == null) return null;
        return value.toLowerCase() == 'true';
      } else {
        final prefs = await SharedPreferences.getInstance();
        return prefs.getBool(key);
      }
    } catch (e) {
      debugPrint('Error getting bool from storage for key "$key": $e');
      return null;
    }
  }

  /// Save a boolean value to storage
  /// Returns true if successful, false otherwise
  static Future<bool> setBool(String key, bool value) async {
    try {
      if (kIsWeb) {
        html.window.localStorage[key] = value.toString();
        return true;
      } else {
        final prefs = await SharedPreferences.getInstance();
        return await prefs.setBool(key, value);
      }
    } catch (e) {
      debugPrint('Error setting bool to storage for key "$key": $e');
      return false;
    }
  }

  /// Get a JSON object from storage
  /// Returns null if the key doesn't exist, parsing fails, or there's an error
  static Future<Map<String, dynamic>?> getJson(String key) async {
    try {
      final jsonString = await getString(key);
      if (jsonString == null || jsonString.isEmpty) {
        return null;
      }
      return jsonDecode(jsonString) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('Error getting JSON from storage for key "$key": $e');
      return null;
    }
  }

  /// Save a JSON object to storage
  /// Returns true if successful, false otherwise
  static Future<bool> setJson(String key, Map<String, dynamic> value) async {
    try {
      final jsonString = jsonEncode(value);
      return await setString(key, jsonString);
    } catch (e) {
      debugPrint('Error setting JSON to storage for key "$key": $e');
      return false;
    }
  }

  /// Remove a value from storage
  /// Returns true if the key was removed, false otherwise
  static Future<bool> remove(String key) async {
    try {
      if (kIsWeb) {
        html.window.localStorage.remove(key);
        return true;
      } else {
        final prefs = await SharedPreferences.getInstance();
        return await prefs.remove(key);
      }
    } catch (e) {
      debugPrint('Error removing key "$key" from storage: $e');
      return false;
    }
  }

  /// Remove multiple keys from storage
  /// Returns the number of keys successfully removed
  static Future<int> removeMultiple(List<String> keys) async {
    int removedCount = 0;
    for (final key in keys) {
      final success = await remove(key);
      if (success) removedCount++;
    }
    return removedCount;
  }

  /// Check if a key exists in storage
  /// Returns true if the key exists, false otherwise
  static Future<bool> containsKey(String key) async {
    try {
      if (kIsWeb) {
        return html.window.localStorage.containsKey(key);
      } else {
        final prefs = await SharedPreferences.getInstance();
        return prefs.containsKey(key);
      }
    } catch (e) {
      debugPrint('Error checking if key "$key" exists in storage: $e');
      return false;
    }
  }

  /// Get all keys from storage
  /// Returns an empty list if there's an error
  static Future<List<String>> getKeys() async {
    try {
      if (kIsWeb) {
        return html.window.localStorage.keys.toList();
      } else {
        final prefs = await SharedPreferences.getInstance();
        return prefs.getKeys().toList();
      }
    } catch (e) {
      debugPrint('Error getting keys from storage: $e');
      return [];
    }
  }

  /// Clear all data from storage
  /// Returns true if successful, false otherwise
  static Future<bool> clear() async {
    try {
      if (kIsWeb) {
        html.window.localStorage.clear();
        return true;
      } else {
        final prefs = await SharedPreferences.getInstance();
        return await prefs.clear();
      }
    } catch (e) {
      debugPrint('Error clearing storage: $e');
      return false;
    }
  }
}






