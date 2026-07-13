import '../models/scheduled_payment.dart';
import 'api_service.dart';

class ScheduledPaymentService {
  final ApiService _apiService;

  ScheduledPaymentService(this._apiService);

  // Create scheduled payment
  Future<Map<String, dynamic>> createScheduledPayment({
    required String accountId,
    required String recipientName,
    required String recipientAccount,
    required String recipientBank,
    required double amount,
    required String frequency,
    required DateTime startDate,
    DateTime? endDate,
    String? description,
    int? maxExecutions,
  }) async {
    try {
      final response = await _apiService.post('/payment-processing/scheduled-payments', data: {
        'account_id': accountId,
        'recipient_name': recipientName,
        'recipient_account': recipientAccount,
        'recipient_bank': recipientBank,
        'amount': amount,
        'frequency': frequency,
        'start_date': startDate.toIso8601String(),
        'end_date': endDate?.toIso8601String(),
        'description': description,
        'max_executions': maxExecutions,
      });

      if (response.data['success'] == true) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Scheduled payment created successfully',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to create scheduled payment',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Get all scheduled payments
  Future<List<ScheduledPayment>> getScheduledPayments({String? accountId, String? status}) async {
    try {
      String endpoint = '/payment-processing/scheduled-payments';
      final params = <String>[];
      
      if (accountId != null) params.add('account_id=$accountId');
      if (status != null) params.add('status=$status');
      
      if (params.isNotEmpty) {
        endpoint += '?${params.join('&')}';
      }

      final response = await _apiService.get(endpoint);

      if (response.data['success'] == true) {
        final paymentsData = response.data['data'] as List;
        return paymentsData.map((json) => ScheduledPayment.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }

  // Update scheduled payment status
  Future<Map<String, dynamic>> updatePaymentStatus({
    required String paymentId,
    required String status,
  }) async {
    try {
      final response = await _apiService.put('/payment-processing/scheduled-payments/$paymentId/status', data: {
        'status': status,
      });

      if (response.data['success'] == true) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Status updated successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to update status',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Delete scheduled payment
  Future<Map<String, dynamic>> deleteScheduledPayment(String paymentId) async {
    try {
      final response = await _apiService.delete('/payment-processing/scheduled-payments/$paymentId');

      if (response.data['success'] == true) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Scheduled payment deleted successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to delete scheduled payment',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Get scheduled payment details
  Future<ScheduledPayment?> getPaymentDetails(String paymentId) async {
    try {
      final response = await _apiService.get('/payment-processing/scheduled-payments/$paymentId');

      if (response.data['success'] == true) {
        return ScheduledPayment.fromJson(response.data['data']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Pause scheduled payment
  Future<Map<String, dynamic>> pausePayment(String paymentId) async {
    return updatePaymentStatus(paymentId: paymentId, status: 'paused');
  }

  // Resume scheduled payment
  Future<Map<String, dynamic>> resumePayment(String paymentId) async {
    return updatePaymentStatus(paymentId: paymentId, status: 'active');
  }

  // Cancel scheduled payment
  Future<Map<String, dynamic>> cancelPayment(String paymentId) async {
    return updatePaymentStatus(paymentId: paymentId, status: 'cancelled');
  }
}
