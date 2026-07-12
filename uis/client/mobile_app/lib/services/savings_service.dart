import 'dart:convert';
import '../models/savings.dart';
import 'api_service.dart';
import '../config/app_config.dart';
import '../models/error_response.dart';
import '../services/error_handler_service.dart';
import 'package:flutter/material.dart';




class SavingsService {
  final ApiService _apiService;

  SavingsService(this._apiService);

  // Get all savings for the current user
  Future<List<Savings>> getAllSavings() async {
    try {
      final response = await _apiService.get('${AppConfig.savingsEndpoint}/savings');

      if (response.statusCode == 200) {
        final data = response.data;

        // Handle different response structures
        dynamic savingsData;

        // If response.data is already a List, use it directly
        if (data is List) {
          savingsData = data;
        }
        // If response.data is a Map with 'data' key, extract it
        else if (data is Map && data.containsKey('data')) {
          savingsData = data['data'];
        }
        // Otherwise use data as-is
        else {
          savingsData = data;
        }
        
        // If data is a string, try to parse it as JSON
        if (savingsData is String) {
          try {
            savingsData = jsonDecode(savingsData);
          } catch (e) {
            throw Exception('Invalid data format: expected JSON array');
          }
        }
        
        // Ensure it's a List
        if (savingsData is! List) {
          // If it's a single object, wrap it in a list
          if (savingsData is Map) {
            savingsData = [savingsData];
          } else {
            throw Exception('Invalid data format: expected array or object');
          }
        }
        
        final savingsList = savingsData;
        return savingsList.map((json) {
          // Ensure json is a Map
          if (json is Map<String, dynamic>) {
            return Savings.fromJson(json);
          } else if (json is Map) {
            return Savings.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid savings data format');
          }
        }).toList();
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch savings');
      }
    } catch (e) {
      throw Exception('Failed to fetch savings: ${e.toString()}');
    }
  }

  // Create a new savings
  // Accepts: name, target_amount (int), target_date (ISO 8601 string), enable_auto_save (bool)
  Future<Savings> createSavings({
    required String name,
    required int targetAmount,
    required DateTime targetDate,
    required bool enableAutoSave,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.savingsEndpoint}/savings',
        data: {
          'name': name,
          'target_amount': targetAmount,
          'target_date': targetDate.toUtc().toIso8601String(),
          'enable_auto_save': enableAutoSave,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;

        // Backend returns {status: "created", goal_id, goal_name, savings_account_id, enable_auto_save}
        // Reconstruct a full Savings object from the response + original request params.
        if (data is Map && data['status'] == 'created' && data.containsKey('goal_id')) {
          return Savings.fromJson({
            'goal_id': data['goal_id'],
            'id': data['goal_id'],
            'goal_name': data['goal_name'] ?? name,
            'target_amount': targetAmount.toDouble(),
            'current_amount': 0.0,
            'target_date': targetDate.toIso8601String(),
            'enable_auto_save': data['enable_auto_save'] ?? enableAutoSave,
            'savings_account_id': data['savings_account_id'],
            'status': 'active',
            'created_at': DateTime.now().toIso8601String(),
          });
        }

        dynamic savingsData;

        if (data is Map) {
          if (data.containsKey('data') && data['data'] != null) {
            savingsData = data['data'];
          } else if (data.containsKey('savings') && data['savings'] != null) {
            savingsData = data['savings'];
          } else if (data.containsKey('result') && data['result'] != null) {
            savingsData = data['result'];
          } else {
            savingsData = data;
          }
        } else {
          savingsData = data;
        }

        if (savingsData is String) {
          try {
            savingsData = jsonDecode(savingsData);
          } catch (e) {
            throw Exception('Invalid data format: expected JSON object');
          }
        }

        if (savingsData == null || savingsData is! Map) {
          throw Exception('No savings data received from server');
        }

        return Savings.fromJson(
          savingsData is Map<String, dynamic>
              ? savingsData
              : Map<String, dynamic>.from(savingsData),
        );
      } else {
        throw Exception(response.data['message'] ?? 'Failed to create savings');
      }
    } catch (e) {
      throw Exception('Failed to create savings: ${e.toString()}');
    }
  }

  // Update savings
  Future<Savings> updateSavings({
    required String id,
    String? name,
    String? description,
    double? targetAmount,
    String? frequency,
    double? contributionAmount,
    DateTime? endDate,
    String? status,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (name != null) data['name'] = name;
      if (description != null) data['description'] = description;
      if (targetAmount != null) data['target_amount'] = targetAmount;
      if (frequency != null) data['frequency'] = frequency;
      if (contributionAmount != null) data['contribution_amount'] = contributionAmount;
      if (endDate != null) data['end_date'] = endDate.toIso8601String();
      if (status != null) data['status'] = status;

      final response = await _apiService.put('${AppConfig.savingsEndpoint}/savings/$id', data: data);
      
      if (response.statusCode == 200) {
        final responseData = response.data;
        dynamic savingsData = responseData['data'];
        
        // If data is a string, try to parse it as JSON
        if (savingsData is String) {
          try {
            savingsData = jsonDecode(savingsData);
          } catch (e) {
            throw Exception('Invalid data format: expected JSON object');
          }
        }
        
        // Ensure it's a Map
        if (savingsData is! Map) {
          throw Exception('Invalid data format: expected object');
        }
        
        if (savingsData is Map<String, dynamic>) {
          return Savings.fromJson(savingsData);
        } else {
          return Savings.fromJson(Map<String, dynamic>.from(savingsData));
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to update savings');
      }
    } catch (e) {
      throw Exception('Failed to update savings: ${e.toString()}');
    }
  }

  // Make a contribution to savings (matching web app)
  Future<void> makeContribution({
    required String savingsId,
    required double amount,
    required String customerAccount, // Added to match API requirements
    required String pin,
  }) async {
      debugPrint('Making contribution: savingsId=$savingsId, amount=$amount, customerAccount=$customerAccount');
    try {
      final response = await _apiService.post(
        '${AppConfig.savingsEndpoint}/savings/deposit',
        data: {
          'amount': amount,
          'account_id': savingsId,
          'customer_account': customerAccount,
          'pin': pin,
        },
      );


      
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception(response.data['message'] ?? 'Failed to make contribution');
      }
    } catch (e) {
      debugPrint('Making contribution: savingsId=$savingsId, amount=$amount, customerAccount=$customerAccount , pin=$pin');
      ErrorHandlerService.handleError(e);
      throw Exception('Failed to make contribution: ${e.toString()}');
    }
  }

  // Withdraw from savings (matching web app)
  Future<void> withdrawFromSavings({
    required String savingsId,
    required double amount,
    String? reason,
    required String customerAccount,
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.savingsEndpoint}/savings/withdrawal',
        data: {
          'amount': amount,
          'account_id': savingsId,
          'customer_account': customerAccount,
        },
      );
      
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception(response.data['message'] ?? 'Failed to withdraw');
      }
    } catch (e) {
      throw Exception('Failed to withdraw: ${e.toString()}');
    }
  }

  // Delete savings (matching web app: returns { success: boolean; message: string })
  Future<Map<String, dynamic>> deleteSavings(String id) async {
    try {
      final response = await _apiService.delete('${AppConfig.savingsEndpoint}/savings/$id');
      
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Savings deleted successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to delete savings',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error deleting savings: ${e.toString()}',
      };
    }
  }

  // Pause savings (matching web app: POST to /{id}/pause)
  Future<Savings> pauseSavings(String id) async {
    try {
      final response = await _apiService.post('${AppConfig.savingsEndpoint}/savings/$id/pause');
      
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic savingsData = data['data'];
        
        // If data is a string, try to parse it as JSON
        if (savingsData is String) {
          try {
            savingsData = jsonDecode(savingsData);
          } catch (e) {
            throw Exception('Invalid data format: expected JSON object');
          }
        }
        
        // Ensure it's a Map
        if (savingsData is! Map) {
          throw Exception('Invalid data format: expected object');
        }
        
        if (savingsData is Map<String, dynamic>) {
          return Savings.fromJson(savingsData);
        } else {
          return Savings.fromJson(Map<String, dynamic>.from(savingsData));
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to pause savings');
      }
    } catch (e) {
      throw Exception('Failed to pause savings: ${e.toString()}');
    }
  }

  // Resume savings (matching web app: POST to /{id}/resume)
  Future<Savings> resumeSavings(String id) async {
    try {
      final response = await _apiService.post('${AppConfig.savingsEndpoint}/savings/$id/resume');
      
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic savingsData = data['data'];
        
        // If data is a string, try to parse it as JSON
        if (savingsData is String) {
          try {
            savingsData = jsonDecode(savingsData);
          } catch (e) {
            throw Exception('Invalid data format: expected JSON object');
          }
        }
        
        // Ensure it's a Map
        if (savingsData is! Map) {
          throw Exception('Invalid data format: expected object');
        }
        
        if (savingsData is Map<String, dynamic>) {
          return Savings.fromJson(savingsData);
        } else {
          return Savings.fromJson(Map<String, dynamic>.from(savingsData));
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to resume savings');
      }
    } catch (e) {
      throw Exception('Failed to resume savings: ${e.toString()}');
    }
  }
}
