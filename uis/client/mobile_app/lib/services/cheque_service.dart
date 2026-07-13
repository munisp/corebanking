import '../models/cheque.dart';
import 'api_service.dart';

class ChequeService {
  final ApiService _apiService;

  ChequeService(this._apiService);

  // Request new cheque book
  Future<Map<String, dynamic>> requestChequeBook({
    required String accountId,
    required int numberOfLeaves,
    required String deliveryMethod,
    String? deliveryAddress,
    String? branchName,
  }) async {
    try {
      final response = await _apiService.post('/payment-processing/cheques/request', data: {
        'account_id': accountId,
        'number_of_leaves': numberOfLeaves,
        'delivery_method': deliveryMethod,
        'delivery_address': deliveryAddress,
        'branch_name': branchName,
      });

      if (response.data['success'] == true) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Cheque book requested successfully',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to request cheque book',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Get all cheques for user
  Future<List<Cheque>> getCheques({String? accountId}) async {
    try {
      final endpoint = accountId != null
          ? '/payment-processing/cheques?account_id=$accountId'
          : '/payment-processing/cheques';
      
      final response = await _apiService.get(endpoint);

      if (response.data['success'] == true) {
        final chequesData = response.data['data'] as List;
        return chequesData.map((json) => Cheque.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }

  // Stop cheque
  Future<Map<String, dynamic>> stopCheque({
    required String chequeId,
    required String reason,
  }) async {
    try {
      final response = await _apiService.post('/payment-processing/cheques/$chequeId/stop', data: {
        'reason': reason,
      });

      if (response.data['success'] == true) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Cheque stopped successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to stop cheque',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Get cheque details
  Future<Cheque?> getChequeDetails(String chequeId) async {
    try {
      final response = await _apiService.get('/payment-processing/cheques/$chequeId');

      if (response.data['success'] == true) {
        return Cheque.fromJson(response.data['data']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
