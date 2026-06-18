import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import '../models/wallet.dart';
import '../models/transaction.dart';
import '../config/app_config.dart';
import 'api_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;


class WalletService {
  final ApiService _apiService;
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      resetOnError: true,
    ),
  );

  WalletService(this._apiService);

  /// Helper to get account_id from storage with multiple fallback options
  Future<String?> _getAccountIdFromStorage() async {
    String? accountId;
    
    try {
      if (kIsWeb) {
        // Try multiple sources in order
        accountId = html.window.localStorage['account_id'];
        
        if (accountId == null || accountId.isEmpty) {
          // Fallback 1: Try to get from account object
          final accountJson = html.window.localStorage['account'];
          if (accountJson != null && accountJson.isNotEmpty) {
            try {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
              debugPrint('[WalletService] Got account_id from account object: $accountId');
            } catch (e) {
              debugPrint('[WalletService] Failed to parse account JSON: $e');
            }
          }
        }
        
        if (accountId == null || accountId.isEmpty) {
          // Fallback 2: Try to get from user object
          final userJson = html.window.localStorage['user'];
          if (userJson != null && userJson.isNotEmpty) {
            try {
              final userData = jsonDecode(userJson);
              accountId = userData['account_id']?.toString();
              debugPrint('[WalletService] Got account_id from user object: $accountId');
            } catch (e) {
              debugPrint('[WalletService] Failed to parse user JSON: $e');
            }
          }
        }
        
        debugPrint('[WalletService] Web - Final account_id: $accountId');
      } else {
        final prefs = await SharedPreferences.getInstance();
        
        // Try multiple sources in order
        accountId = prefs.getString('account_id');
        
        if (accountId == null || accountId.isEmpty) {
          // Fallback 1: Try to get from account object
          final accountJson = prefs.getString('account');
          if (accountJson != null && accountJson.isNotEmpty) {
            try {
              final accountData = jsonDecode(accountJson);
              accountId = accountData['id']?.toString();
              debugPrint('[WalletService] Got account_id from account object: $accountId');
            } catch (e) {
              debugPrint('[WalletService] Failed to parse account JSON: $e');
            }
          }
        }
        
        if (accountId == null || accountId.isEmpty) {
          // Fallback 2: Try to get from user object
          final userJson = prefs.getString('user');
          if (userJson != null && userJson.isNotEmpty) {
            try {
              final userData = jsonDecode(userJson);
              accountId = userData['account_id']?.toString();
              debugPrint('[WalletService] Got account_id from user object: $accountId');
            } catch (e) {
              debugPrint('[WalletService] Failed to parse user JSON: $e');
            }
          }
        }
        
        debugPrint('[WalletService] Mobile - Final account_id: $accountId');
      }
    } catch (e) {
      debugPrint('[WalletService] Error getting account_id from storage: $e');
    }
    
    return accountId;
  }

  // =================== GET WALLET ===================
  /// Matches web app: ${AppConfig.accountEndpoint}/account/keycloak/${keycloak_id}
  Future<Wallet> getMyWallet() async {
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
          final prefs = await SharedPreferences.getInstance();
          keycloakId = prefs.getString('keycloak_id');
        } catch (_) {
          // Skip if fails
        }
      }
      
      if (keycloakId == null) {
        throw Exception('No keycloak_id found');
      }

      // Matches web app: ${AppConfig.accountEndpoint}/account/keycloak/${keycloakId}
      final response = await _apiService.get('${AppConfig.accountEndpoint}/keycloak/$keycloakId');
      debugPrint('Wallet Response: ${response.data}');

      // Web app: response.data.success === true || response.status === 200, then response.data.account
      if (response.data['success'] == true || response.statusCode == 200) {
        // Web app uses: response.data.account
        final accountData = response.data['account'] as Map<String, dynamic>?;
        
        if (accountData == null) {
          throw Exception('No account data in response');
        }
        
        // Store account data (matching web app exactly)
        // Web app: localStorage.setItem('account', data) and localStorage.setItem('account_id', data.id)
        // Note: Web app stores object directly, but we need JSON string for mobile
        try {
          if (kIsWeb) {
            // Flutter web: use localStorage
            html.window.localStorage['account'] = jsonEncode(accountData);
            if (accountData['id'] != null) {
              html.window.localStorage['account_id'] = accountData['id'].toString();
              // Also store in 'user' key for API service lookup (matching web app api_service.ts line 42)
              html.window.localStorage['user'] = jsonEncode({'account_id': accountData['id']});
            }
          } else {
            // Mobile: use SharedPreferences
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('account', jsonEncode(accountData));
            if (accountData['id'] != null) {
              await prefs.setString('account_id', accountData['id'].toString());
              // Also store in 'user' key for API service lookup (matching web app api_service.ts line 42)
              await prefs.setString('user', jsonEncode({'account_id': accountData['id']}));
            }
            debugPrint('Stored account_id: ${accountData['id']}');
          }
        } catch (e) {
          debugPrint('Failed to store account data: $e');
          // Don't throw - continue even if storage fails
        }
        
        // Map account data to Wallet model (matching web app structure)
        return Wallet.fromJson(accountData);
      }
      throw Exception('Failed to fetch wallet');
    } catch (e) {
      throw Exception('Failed to fetch wallet: $e');
    }
  }

  // =================== DEPOSIT FUNDS ===================
  Future<Wallet> depositFunds(double amount, String method) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.walletEndpoint}/my-wallet/deposit',
        data: {
          'amount': amount,
          'method': method,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        final data = response.data['data'] as Map<String, dynamic>;
        return Wallet.fromJson(data);
      }
      throw Exception('Failed to deposit funds');
    } catch (e) {
      throw Exception('Failed to deposit funds: $e');
    }
  }

  // =================== GET BALANCE ===================
  Future<double> getBalance() async {
    try {
      final response = await _apiService.get('${AppConfig.walletEndpoint}/my-wallet/balance');

      if (response.data['success'] == true || response.statusCode == 200) {
        return (response.data['data']['balance'] ?? 0).toDouble();
      }
      throw Exception('Failed to fetch balance');
    } catch (e) {
      throw Exception('Failed to fetch balance: $e');
    }
  }

  // =================== GET TRANSACTIONS ===================
  /// Matches web app: ${AppConfig.transactionEndpoint}/account/${account_id}
  Future<List<Transaction>> getTransactions({
    int page = 1,
    int limit = 20,
    String? type,
    String? category,
    String? status,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      // Get account_id from storage with fallback logic
      final accountId = await _getAccountIdFromStorage();
      
      debugPrint('[WalletService] Getting transactions for account_id: $accountId');
      
      if (accountId == null || accountId.isEmpty) {
        throw Exception('No account_id found. Please ensure you have an active account.');
      }

      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      
      if (type != null) queryParams['type'] = type;
      if (category != null) queryParams['category'] = category;
      if (status != null) queryParams['status'] = status;
      if (startDate != null) queryParams['start_date'] = startDate.toIso8601String();
      if (endDate != null) queryParams['end_date'] = endDate.toIso8601String();

      // Use account_id in path (matching web app exactly: ${AppConfig.transactionEndpoint}/account/${account_id})
      debugPrint('[WalletService] Calling: ${AppConfig.transactionEndpoint}/account/$accountId');
      final response = await _apiService.get(
        '${AppConfig.transactionEndpoint}/account/$accountId',
        queryParameters: queryParams,
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        // Web app response structure: response.data.transactions
        final transactionsData = response.data['transactions'] as List<dynamic>? ?? 
                                 response.data['data'] as List<dynamic>? ?? [];
        
        debugPrint('[WalletService] Received ${transactionsData.length} transactions');
        
        // Get user's account_id to determine credit/debit (matching web app)
        final myAccountId = await _getAccountIdFromStorage();
        
        return transactionsData.map((json) {
          final txJson = json as Map<String, dynamic>;
          
          // Determine type based on payer/payee (matching web app: getTransactionType)
          // If I'm the payee, it's a credit (money coming in)
          // If I'm the payer, it's a debit (money going out)
          String? type = txJson['type'];
          if (type == null && myAccountId != null) {
            final payer = txJson['payer']?.toString();
            final payee = txJson['payee']?.toString();
            final note = txJson['note']?.toString() ?? '';
            
            if (payee == myAccountId && !(note.contains('Transfer'))) {
              type = 'credit';  // User is receiving money
            } else if (payer == myAccountId ) {
              type = 'debit';   // User is sending money
            } else {
              type = 'debit';   // Default to debit if user is neither
            }
          }
          
          // Add type to json if not present
          if (type != null && txJson['type'] == null) {
            txJson['type'] = type;
          }
          
          return Transaction.fromJson(txJson);
        }).toList();
      }
      
      return [];
    } catch (e) {
      debugPrint('[WalletService] Error fetching transactions: $e');
      throw Exception('Failed to fetch transactions: $e');
    }
  }

  // =================== GET SINGLE TRANSACTION ===================
  /// Matches web app: ${AppConfig.transactionEndpoint}/${transactionId}
  Future<Transaction> getTransaction(String transactionId) async {
    try {
      final response = await _apiService.get(
        '${AppConfig.transactionEndpoint}/$transactionId',
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        // Web app response structure: response.data.data or response.data
        final transactionData = response.data['transaction'] ?? response.data;
        return Transaction.fromJson(transactionData as Map<String, dynamic>);
      }
      
      throw Exception('Transaction not found');
    } catch (e) {
      throw Exception('Failed to fetch transaction: $e');
    }
  }

  // =================== GET STATEMENT ===================
  Future<List<Transaction>> getStatement({
    required DateTime startDate,
    required DateTime endDate,
    String format = 'json',
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'start_date': startDate.toIso8601String(),
        'end_date': endDate.toIso8601String(),
        'format': format,
      };

      final response = await _apiService.get(
        '${AppConfig.walletEndpoint}/my-wallet/statement',
        queryParameters: queryParams,
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        final transactionsData = response.data['data'] as List<dynamic>? ?? [];
        return transactionsData
            .map((json) => Transaction.fromJson(json as Map<String, dynamic>))
            .toList();
      }

      return [];
    } catch (e) {
      throw Exception('Failed to fetch statement: $e');
    }
  }

  // =================== GET STATISTICS ===================
  Future<Map<String, dynamic>> getStatistics({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (startDate != null) queryParams['start_date'] = startDate.toIso8601String();
      if (endDate != null) queryParams['end_date'] = endDate.toIso8601String();

      final response = await _apiService.get(
        '${AppConfig.walletEndpoint}/my-wallet/statistics',
        queryParameters: queryParams,
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return Map<String, dynamic>.from(response.data['data'] as Map<String, dynamic>);
      }

      return {
        'total_credits': 0,
        'total_debits': 0,
        'pending_transactions': 0,
        'completed_transactions': 0,
        'failed_transactions': 0,
      };
    } catch (e) {
      throw Exception('Failed to fetch statistics: $e');
    }
  }
}