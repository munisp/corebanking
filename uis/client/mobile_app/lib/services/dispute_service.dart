import '../models/dispute.dart';
import 'api_service.dart';
import 'error_handler_service.dart';

class DisputeService {
  final ApiService _apiService = ApiService();

  // Get all disputes for the current user
  Future<List<Dispute>> getAllDisputes() async {
    try {
      final response = await _apiService.get('/dispute/api/v1/disputes');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        // Handle different response structures
        dynamic disputesData;
        
        // If response.data is already a List, use it directly
        if (data is List) {
          disputesData = data;
        }
        // If response.data is a Map with 'data' key, extract it
        else if (data is Map && data.containsKey('data')) {
          disputesData = data['data'];
        }
        // Otherwise use data as-is
        else {
          disputesData = data;
        }
        
        // If data is a string, it might be empty or invalid - return empty list
        if (disputesData is String) {
          return [];
        }
        
        // Ensure it's a List
        if (disputesData is! List) {
          // If it's a single object, wrap it in a list
          if (disputesData is Map) {
            disputesData = [disputesData];
          } else {
            // No data or invalid format - return empty list
            return [];
          }
        }
        
        final disputesList = disputesData;
        return disputesList.map((json) {
          // Ensure json is a Map
          if (json is Map<String, dynamic>) {
            return Dispute.fromJson(json);
          } else if (json is Map) {
            return Dispute.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid dispute data format');
          }
        }).toList();
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Get a specific dispute by ID
  Future<Dispute> getDisputeById(String id) async {
    try {
      final response = await _apiService.get('/dispute/$id');
      
      if (response.statusCode == 200) {
        final data = response.data;
        return Dispute.fromJson(data['data']);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Create a new dispute
  Future<Dispute> createDispute({
    required String transactionId,
    required String disputeType,
    required String description,
  }) async {
    try {
      final response = await _apiService.post(
        '/dispute/api/v1/disputes',
        data: {
          'transaction_id': transactionId,
          'dispute_type': disputeType,
          'description': description,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        return Dispute.fromJson(data['dispute_id']);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Update dispute
  Future<Dispute> updateDispute({
    required String id,
    String? subject,
    String? description,
    String? category,
    List<String>? attachments,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (subject != null) data['subject'] = subject;
      if (description != null) data['description'] = description;
      if (category != null) data['category'] = category;
      if (attachments != null) data['attachments'] = attachments;

      final response = await _apiService.put('/dispute/dispute/$id', data: data);
      
      if (response.statusCode == 200) {
        final responseData = response.data;
        return Dispute.fromJson(responseData['data']);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Add comment to dispute
  Future<void> addComment({
    required String disputeId,
    required String comment,
  }) async {
    try {
      final response = await _apiService.post(
        '/dispute/dispute/$disputeId/comments',
        data: {
          'comment': comment,
        },
      );
      
      if (response.statusCode != 200 && response.statusCode != 201) {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Get dispute comments
  Future<List<Map<String, dynamic>>> getDisputeComments(String disputeId) async {
    try {
      final response = await _apiService.get('/dispute/dispute/$disputeId/comments');
      
      if (response.statusCode == 200) {
        final data = response.data;
        return List<Map<String, dynamic>>.from(data['data'] ?? []);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Cancel dispute
  Future<Dispute> cancelDispute(String id) async {
    try {
      final response = await _apiService.post('/dispute/dispute/$id/cancel');
      
      if (response.statusCode == 200) {
        final data = response.data;
        return Dispute.fromJson(data['data']);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Escalate dispute
  Future<Dispute> escalateDispute(String id, {String? reason}) async {
    try {
      final response = await _apiService.post(
        '/dispute/dispute/$id/escalate',
        data: {
          if (reason != null) 'reason': reason,
        },
      );
      
      if (response.statusCode == 200) {
        final data = response.data;
        return Dispute.fromJson(data['data']);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Delete dispute
  Future<void> deleteDispute(String id) async {
    try {
      final response = await _apiService.delete('/dispute/dispute/$id');
      
      if (response.statusCode != 200 && response.statusCode != 204) {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // Upload attachment
  Future<String> uploadAttachment({
    required String disputeId,
    required String filePath,
  }) async {
    try {
      // This would typically use FormData for file upload
      // Implementation depends on your backend file upload requirements
      final response = await _apiService.post(
        '/dispute/$disputeId/attachments',
        data: {
          'file_path': filePath,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        return data['data']['url'] ?? data['data']['file_url'] ?? '';
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }
}
