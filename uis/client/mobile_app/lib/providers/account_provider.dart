import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;
import '../models/account.dart';
import '../services/api_service.dart';
import '../config/app_config.dart';

class AccountProvider extends ChangeNotifier {
  final ApiService _apiService;
  
  List<BankAccount> _accounts = [];
  BankAccount? _activeAccount;
  bool _isLoading = false;
  String? _error;

  AccountProvider(this._apiService);

  List<BankAccount> get accounts => _accounts;
  BankAccount? get activeAccount => _activeAccount;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Fetch all user accounts
  /// Matches web app: ${AppConfig.accountEndpoint}?user_id=${userId}
  Future<void> fetchAccounts() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Get user_id from storage (matching web app)
      // For now, we'll use keycloak_id as user_id if available
      String? userId;
      try {
        final prefs = await SharedPreferences.getInstance();
        userId = prefs.getString('keycloak_id');
      } catch (_) {
        // Skip if fails
      }
      
      if (userId == null) {
        throw Exception('No user_id found. Please login again.');
      }
      
      // Web app endpoint: ${AppConfig.accountEndpoint}?user_id=${userId}
      final response = await _apiService.get('${AppConfig.accountEndpoint}?user_id=$userId');
      
      if (response.data['success'] == true) {
        final accountsData = response.data['data'] as List;
        _accounts = accountsData.map((json) => BankAccount.fromJson(json)).toList();
        
        // Set primary account as active
        _activeAccount = _accounts.firstWhere(
          (account) => account.isPrimary,
          orElse: () => _accounts.isNotEmpty ? _accounts.first : throw Exception('No accounts found'),
        );
        
        // Store account data in localStorage/SharedPreferences (matching web app behavior)
        // Web app: localStorage.setItem('account', data) and localStorage.setItem('account_id', data.id)
        // Also stores 'user' key with account_id for x-default-account-id header lookup
        try {
          final accountJson = _activeAccount!.toJson();
          
          if (kIsWeb) {
            // Try localStorage first (Flutter web)
            try {
              html.window.localStorage['account'] = jsonEncode(accountJson);
              html.window.localStorage['account_id'] = _activeAccount!.id.toString();
              // Also store in 'user' key for API service lookup (matching web app)
              html.window.localStorage['user'] = jsonEncode({'account_id': _activeAccount!.id});
            } catch (e) {
              print('Failed to store account in localStorage: $e');
            }
          } else {
            // If localStorage not available (mobile), use SharedPreferences
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('account', jsonEncode(accountJson));
            await prefs.setString('account_id', _activeAccount!.id.toString());
            // Also store in 'user' key for API service lookup (matching web app)
            await prefs.setString('user', jsonEncode({'account_id': _activeAccount!.id}));
          }
        } catch (e) {
          print('Failed to store account data: $e');
          // Don't throw - account fetching succeeded, storage is just a bonus
        }
      } else {
        _error = response.data['message'] ?? 'Failed to fetch accounts';
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Switch active account
  void switchAccount(String accountId) {
    final account = _accounts.firstWhere(
      (acc) => acc.id == accountId,
      orElse: () => throw Exception('Account not found'),
    );
    _activeAccount = account;
    notifyListeners();
  }

  // Create new account
  /// Matches web app: ${AppConfig.accountEndpoint}/account
  Future<bool> createAccount({
    required String accountType,
    required String accountName,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Get user_id from storage (matching web app)
      String? userId;
      try {
        final prefs = await SharedPreferences.getInstance();
        userId = prefs.getString('keycloak_id');
      } catch (_) {
        // Skip if fails
      }
      
      if (userId == null) {
        throw Exception('No user_id found. Please login again.');
      }
      
      // Web app endpoint: ${AppConfig.accountEndpoint}/account
      final response = await _apiService.post('${AppConfig.accountEndpoint}/account', data: {
        'user_id': userId,
        'account_type': accountType,
        'account_name': accountName,
        'currency': 'NGN', // Default currency (matching web app)
      });

      if (response.data['success'] == true) {
        final newAccount = BankAccount.fromJson(response.data['data']);
        _accounts.add(newAccount);
        notifyListeners();
        return true;
      } else {
        _error = response.data['message'] ?? 'Failed to create account';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Set account as primary
  /// Matches web app: ${AppConfig.accountEndpoint}/${accountId}/set-primary
  Future<bool> setPrimaryAccount(String accountId) async {
    try {
      // Web app endpoint: ${AppConfig.accountEndpoint}/${accountId}/set-primary
      final response = await _apiService.post('${AppConfig.accountEndpoint}/$accountId/set-primary');

      if (response.data['success'] == true) {
        // Update local state
        _accounts = _accounts.map((account) {
          return account.copyWith(isPrimary: account.id == accountId);
        }).toList();
        
        _activeAccount = _accounts.firstWhere((acc) => acc.id == accountId);
        
        // Store updated account data in localStorage/SharedPreferences
        try {
          final accountJson = _activeAccount!.toJson();
          
          if (kIsWeb) {
            try {
              html.window.localStorage['account'] = jsonEncode(accountJson);
              html.window.localStorage['account_id'] = _activeAccount!.id.toString();
              html.window.localStorage['user'] = jsonEncode({'account_id': _activeAccount!.id});
            } catch (e) {
              print('Failed to store account in localStorage: $e');
            }
          } else {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('account', jsonEncode(accountJson));
            await prefs.setString('account_id', _activeAccount!.id.toString());
            await prefs.setString('user', jsonEncode({'account_id': _activeAccount!.id}));
          }
        } catch (e) {
          print('Failed to store account data: $e');
        }
        
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  // Get account type details
  Map<String, dynamic> getAccountTypeDetails(String accountType) {
    final accountTypes = {
      'savings': {
        'title': 'Savings Account',
        'icon': Icons.savings_outlined,
        'description': 'Personal saving account with competitive interest rates',
        'color': Colors.green,
      },
      'current': {
        'title': 'Current Account',
        'icon': Icons.account_balance_outlined,
        'description': 'Business transactions with unlimited operations',
        'color': Colors.blue,
      },
      'fixed': {
        'title': 'Fixed Deposit',
        'icon': Icons.lock_clock_outlined,
        'description': 'Long-term investment with higher returns',
        'color': Colors.orange,
      },
      'recurring': {
        'title': 'Recurring Deposit',
        'icon': Icons.autorenew,
        'description': 'Monthly saving with guaranteed returns',
        'color': Colors.purple,
      },
      'domiciliary': {
        'title': 'Domiciliary Account',
        'icon': Icons.currency_exchange,
        'description': 'Foreign currency account',
        'color': Colors.teal,
      },
      'joint': {
        'title': 'Joint Account',
        'icon': Icons.people_outline,
        'description': 'Shared account for multiple users',
        'color': Colors.indigo,
      },
      'student': {
        'title': 'Student Account',
        'icon': Icons.school_outlined,
        'description': 'Special account for students',
        'color': Colors.cyan,
      },
      'salary': {
        'title': 'Salary Account',
        'icon': Icons.work_outline,
        'description': 'For salaried employees',
        'color': Colors.brown,
      },
      'corporate': {
        'title': 'Corporate Account',
        'icon': Icons.business_outlined,
        'description': 'For large companies and enterprises',
        'color': Colors.deepPurple,
      },
      'digital': {
        'title': 'Digital Account',
        'icon': Icons.smartphone_outlined,
        'description': 'Online banking with exclusive digital features',
        'color': Colors.pink,
      },
    };

    return accountTypes[accountType] ?? accountTypes['savings']!;
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
