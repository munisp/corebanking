import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../config/app_config.dart';
import 'api_service.dart';
import 'local_storage_service.dart';
import 'error_handler_service.dart';
import 'package:universal_html/html.dart' as html;

// Type definitions
class Account {
  final String id;
  final String userId;
  final String accountNumber;
  final String accountName;
  final String accountType; // 'savings' | 'current' | 'fixed_deposit' | 'domiciliary' | 'mint'
  final String currency;
  final double balance;
  final String status; // 'active' | 'inactive' | 'frozen'
  final bool isPrimary;
  final DateTime createdAt;

  Account({
    required this.id,
    required this.userId,
    required this.accountNumber,
    required this.accountName,
    required this.accountType,
    required this.currency,
    required this.balance,
    required this.status,
    required this.isPrimary,
    required this.createdAt,
  });

  factory Account.fromJson(Map<String, dynamic> json) {
    return Account(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      accountNumber: json['account_number'] as String,
      accountName: json['account_name'] as String,
      accountType: json['account_type'] as String,
      currency: json['currency'] as String,
      balance: (json['balance'] ?? 0).toDouble(),
      status: json['status'] as String,
      isPrimary: json['is_primary'] ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

class CreateAccountParams {
  final String userId;
  final String accountName;
  final String accountType;
  final String currency;

  CreateAccountParams({
    required this.userId,
    required this.accountName,
    required this.accountType,
    required this.currency,
  });
}

class AccountService {
  final ApiService _apiService = ApiService();

  /// Get all accounts for a user
  Future<List<Account>> getUserAccounts(String userId) async {
    try {
      final response = await _apiService.get('${AppConfig.accountEndpoint}?user_id=$userId');

      if (response.data['success'] == true) {
        final accountsData = response.data['data'] as List<dynamic>;
        return accountsData.map((acc) => Account.fromJson(acc as Map<String, dynamic>)).toList();
      }

      return [];
    } catch (error) {
      // ...existing code...
      rethrow;
    }
  }

  /// Create a new account
  Future<Map<String, dynamic>> createAccount(CreateAccountParams params) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.accountEndpoint}/account',
        data: {
          'user_id': params.userId,
          'account_name': params.accountName,
          'account_type': params.accountType,
          'currency': params.currency,
        },
      );

      if (response.data['success'] == true) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Account created successfully',
          'data': response.data['data'] != null
              ? Account.fromJson(response.data['data'] as Map<String, dynamic>)
              : null,
        };
      }

      return {
        'success': false,
        'message': ErrorHandlerService.handleError(response.data),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(error),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  /// Set an account as primary
  Future<Map<String, dynamic>> setPrimaryAccount(String accountId) async {
    try {
      final response = await _apiService.post('${AppConfig.accountEndpoint}/$accountId/set-primary');

      return {
        'success': response.data['success'] == true,
        'message': response.data['message'] ??
            (response.data['success'] == true ? 'Primary account updated' : 'Failed to set primary account'),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(error),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  /// Freeze an account
  Future<Map<String, dynamic>> freezeAccount(String accountId) async {
    try {
      final response = await _apiService.post('${AppConfig.accountEndpoint}/$accountId/freeze');

      return {
        'success': response.data['success'] == true,
        'message': response.data['message'] ??
            (response.data['success'] == true ? 'Account frozen successfully' : 'Failed to freeze account'),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(error),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  /// Unfreeze an account
  Future<Map<String, dynamic>> unfreezeAccount(String accountId) async {
    try {
      final response = await _apiService.post('${AppConfig.accountEndpoint}/$accountId/unfreeze');

      return {
        'success': response.data['success'] == true,
        'message': response.data['message'] ??
            (response.data['success'] == true ? 'Account unfrozen successfully' : 'Failed to unfreeze account'),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(error),
      };
    } catch (error) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  /// Get a single account by keycloak ID
  /// Matches web app: ${AppConfig.accountEndpoint}/account/keycloak/${keycloak_id}
  Future<Account?> getAccountByKeycloakId(String accountId) async {
    try {
      // Get keycloak_id from storage (matching web app: localStorage.getItem('keycloak_id'))
      String? keycloakId;
      if (kIsWeb) {
        try {
          keycloakId = html.window.localStorage['keycloak_id'];
        } catch (_) {
          // Skip if fails
        }
      } else {
        try {
          keycloakId = await LocalStorageService.getString('keycloak_id');
        } catch (_) {
          // Skip if fails
        }
      }
      
      if (keycloakId == null) {
        throw Exception('No keycloak_id found');
      }

      final response = await _apiService.get('${AppConfig.accountEndpoint}/keycloak/$keycloakId');
      print('Get Account Response: ${response.data}');

      if (response.data['account'] != null) {
        final acc = response.data['account'] as Map<String, dynamic>;
        
        // Store account data (matching web app: localStorage.setItem('account', acc))
        // Note: Web app stores account object directly, but we'll store as JSON string for mobile
        try {
          if (kIsWeb) {
            // Web app: localStorage.setItem('account', acc) - stores object directly
            // For Flutter web, we'll store as JSON string
            html.window.localStorage['account'] = jsonEncode(acc);
            if (acc['id'] != null) {
              html.window.localStorage['account_id'] = acc['id'].toString();
              // Also store in 'user' key for API service lookup (matching web app api_service.ts line 42)
              html.window.localStorage['user'] = jsonEncode({'account_id': acc['id']});
            }
          } else {
            // Store account as JSON string (matching web app behavior)
            await LocalStorageService.setString('account', jsonEncode(acc));
            if (acc['id'] != null) {
              await LocalStorageService.setString('account_id', acc['id'].toString());
              // Also store in 'user' key for API service lookup (matching web app api_service.ts line 42)
              await LocalStorageService.setString('user', jsonEncode({'account_id': acc['id']}));
            }
          }
        } catch (e) {
          print('Failed to store account data: $e');
        }
        
        return Account.fromJson(acc);
      }

      return null;
    } catch (error) {
      // ...existing code...
      rethrow;
    }
  }

  /// Setup transaction PIN
  /// Matches web app: POST /account/setup-pin
  Future<Map<String, dynamic>> setupPin(String pin) async {
    try {
      // Use /account/setup-pin (not accountEndpoint which is /account/account)
      final response = await _apiService.post(
        '/account/account/setup-pin',
        data: {
          'pin': pin,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'PIN setup successfully',
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  /// Verify transaction PIN
  /// Matches web app: POST /account/verify-pin
  Future<Map<String, dynamic>> verifyPin(String pin) async {
    try {
      // Use /account/verify-pin (not accountEndpoint which is /account/account)
      final response = await _apiService.post(
        '/account/account/setup-pin',
        data: {
          'pin': pin,
        },
      );

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'PIN verified successfully',
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  /// Change transaction PIN (verify current, then setup new)
  /// Matches web app: POST /account/verify-pin then POST /account/setup-pin
  Future<Map<String, dynamic>> changePin({
    required String currentPin,
    required String newPin,
  }) async {
    try {
      // First verify current PIN
      final verifyResult = await verifyPin(currentPin);
      if (!verifyResult['success']) {
        return {
          'success': false,
          'message': verifyResult['message'] ?? 'Current PIN is incorrect',
        };
      }

      // Then setup new PIN
      final setupResult = await setupPin(newPin);
      return setupResult;
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }
}

