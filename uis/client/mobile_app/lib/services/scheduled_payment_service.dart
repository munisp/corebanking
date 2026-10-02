import 'package:dio/dio.dart' show Response;

import '../config/app_config.dart';
import '../models/scheduled_payment.dart';
import 'api_service.dart';

// W12-A4B: scheduled payments are served by standing-orders-go
// (AppConfig.scheduledPaymentEndpoint = /standing-orders/v1/standing-orders).
// The backend model is a recurring StandingOrder — payload mapping happens
// here, not in the backend.
class ScheduledPaymentService {
  final ApiService _apiService;

  ScheduledPaymentService(this._apiService);

  /// Maps a standing-orders-go StandingOrder (camelCase) to the snake_case
  /// map [ScheduledPayment.fromJson] expects.
  static Map<String, dynamic> _fromStandingOrder(Map<String, dynamic> so) {
    String? emptyToNull(dynamic v) => (v == null || v.toString().isEmpty) ? null : v.toString();
    return {
      'id': so['id'] ?? '',
      'user_id': so['userId'] ?? '',
      'account_id': so['accountId'] ?? '',
      'recipient_name': so['beneficiaryName'] ?? '',
      'recipient_account': so['beneficiaryId'] ?? '',
      'recipient_bank': so['recipient_bank'] ?? '',
      'amount': so['amount'] ?? 0.0,
      'frequency': so['frequency'] == 'annually' ? 'yearly' : (so['frequency'] ?? 'once'),
      'start_date': so['startDate'],
      'end_date': emptyToNull(so['endDate']),
      'description': so['narration'],
      'status': so['status'] ?? 'active',
      'last_execution_date': emptyToNull(so['lastExecutedAt']),
      'next_execution_date': emptyToNull(so['nextExecutionAt']),
      'execution_count': so['executionCount'] ?? 0,
      'max_executions': (so['maxExecutions'] ?? 0) == 0 ? null : so['maxExecutions'],
      'created_at': so['createdAt'],
    };
  }

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
      final response = await _apiService.post(AppConfig.scheduledPaymentEndpoint, data: {
        'accountId': accountId,
        'beneficiaryName': recipientName,
        'beneficiaryId': recipientAccount,
        'amount': amount,
        // standing-orders-go accepts daily|weekly|biweekly|monthly|quarterly|annually
        'frequency': frequency == 'yearly' ? 'annually' : frequency,
        'startDate': startDate.toIso8601String().substring(0, 10),
        'endDate': endDate == null ? '' : endDate.toIso8601String().substring(0, 10),
        'narration': description ?? 'Scheduled payment to $recipientName',
        'maxExecutions': maxExecutions ?? 0,
      });

      if (response.statusCode == 201 && response.data is Map && response.data['id'] != null) {
        return {
          'success': true,
          'message': 'Scheduled payment created successfully',
          'data': ScheduledPayment.fromJson(_fromStandingOrder(Map<String, dynamic>.from(response.data as Map))),
        };
      } else {
        return {
          'success': false,
          'message': (response.data is Map ? response.data['error'] : null) ?? 'Failed to create scheduled payment',
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
      // W12-A4B: standing-orders-go GET /v1/standing-orders ->
      // { items: [...], total }. No server-side filtering; filter the real
      // result set client-side.
      final response = await _apiService.get(AppConfig.scheduledPaymentEndpoint);

      if (response.statusCode == 200 && response.data is Map) {
        final items = (response.data['items'] ?? []) as List;
        var payments = items
            .map((json) => ScheduledPayment.fromJson(_fromStandingOrder(Map<String, dynamic>.from(json as Map))))
            .toList();
        if (accountId != null) payments = payments.where((p) => p.accountId == accountId).toList();
        if (status != null) payments = payments.where((p) => p.status == status).toList();
        return payments;
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
      // W12-A4B: no status-update route exists; map to standing-orders-go
      // pause/resume/cancel endpoints (orderId body / ?id= query).
      final Response response;
      if (status == 'paused') {
        response = await _apiService.post('${AppConfig.scheduledPaymentEndpoint}/pause', data: {'orderId': paymentId});
      } else if (status == 'active') {
        response = await _apiService.post('${AppConfig.scheduledPaymentEndpoint}/resume', data: {'orderId': paymentId});
      } else if (status == 'cancelled') {
        response = await _apiService.delete('${AppConfig.scheduledPaymentEndpoint}/order', queryParameters: {'id': paymentId});
      } else {
        return {
          'success': false,
          'message': 'Unsupported status transition: $status',
        };
      }

      if (response.statusCode == 200 && response.data is Map && response.data['status'] == status) {
        return {
          'success': true,
          'message': 'Status updated successfully',
        };
      } else {
        return {
          'success': false,
          'message': (response.data is Map ? response.data['error'] : null) ?? 'Failed to update status',
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
      // W12-A4B: soft-cancel via the new standing-orders-go
      // DELETE /v1/standing-orders/order?id=... handler.
      final response = await _apiService.delete('${AppConfig.scheduledPaymentEndpoint}/order', queryParameters: {'id': paymentId});

      if (response.statusCode == 200 && response.data is Map && response.data['status'] == 'cancelled') {
        return {
          'success': true,
          'message': 'Scheduled payment deleted successfully',
        };
      } else {
        return {
          'success': false,
          'message': (response.data is Map ? response.data['error'] : null) ?? 'Failed to delete scheduled payment',
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
      // W12-A4B: item fetch via the new standing-orders-go
      // GET /v1/standing-orders/order?id=... handler (raw StandingOrder JSON).
      final response = await _apiService.get('${AppConfig.scheduledPaymentEndpoint}/order', queryParameters: {'id': paymentId});

      if (response.statusCode == 200 && response.data is Map && response.data['id'] != null) {
        return ScheduledPayment.fromJson(_fromStandingOrder(Map<String, dynamic>.from(response.data as Map)));
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
