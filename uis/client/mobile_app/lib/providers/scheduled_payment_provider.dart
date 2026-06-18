import 'package:flutter/material.dart';
import '../models/scheduled_payment.dart';
import '../services/scheduled_payment_service.dart';

class ScheduledPaymentProvider extends ChangeNotifier {
  final ScheduledPaymentService _paymentService;
  
  List<ScheduledPayment> _scheduledPayments = [];
  bool _isLoading = false;
  String? _error;

  ScheduledPaymentProvider(this._paymentService);

  List<ScheduledPayment> get scheduledPayments => _scheduledPayments;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Get payments filtered by status
  List<ScheduledPayment> getPaymentsByStatus(String status) {
    return _scheduledPayments.where((payment) => payment.status == status).toList();
  }

  // Get active payments
  List<ScheduledPayment> get activePayments {
    return _scheduledPayments.where((payment) => payment.status == 'active').toList();
  }

  // Fetch all scheduled payments
  Future<void> fetchScheduledPayments({String? accountId, String? status}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _scheduledPayments = await _paymentService.getScheduledPayments(
        accountId: accountId,
        status: status,
      );
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Create scheduled payment
  Future<bool> createScheduledPayment({
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
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _paymentService.createScheduledPayment(
        accountId: accountId,
        recipientName: recipientName,
        recipientAccount: recipientAccount,
        recipientBank: recipientBank,
        amount: amount,
        frequency: frequency,
        startDate: startDate,
        endDate: endDate,
        description: description,
        maxExecutions: maxExecutions,
      );

      if (result['success'] == true) {
        // Refresh payments list
        await fetchScheduledPayments(accountId: accountId);
        return true;
      } else {
        _error = result['message'];
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

  // Pause payment
  Future<bool> pausePayment(String paymentId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _paymentService.pausePayment(paymentId);

      if (result['success'] == true) {
        // Update local state
        final index = _scheduledPayments.indexWhere((p) => p.id == paymentId);
        if (index != -1) {
          _scheduledPayments[index] = _scheduledPayments[index].copyWith(status: 'paused');
        }
        notifyListeners();
        return true;
      } else {
        _error = result['message'];
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

  // Resume payment
  Future<bool> resumePayment(String paymentId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _paymentService.resumePayment(paymentId);

      if (result['success'] == true) {
        // Update local state
        final index = _scheduledPayments.indexWhere((p) => p.id == paymentId);
        if (index != -1) {
          _scheduledPayments[index] = _scheduledPayments[index].copyWith(status: 'active');
        }
        notifyListeners();
        return true;
      } else {
        _error = result['message'];
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

  // Cancel payment
  Future<bool> cancelPayment(String paymentId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _paymentService.cancelPayment(paymentId);

      if (result['success'] == true) {
        // Update local state
        final index = _scheduledPayments.indexWhere((p) => p.id == paymentId);
        if (index != -1) {
          _scheduledPayments[index] = _scheduledPayments[index].copyWith(status: 'cancelled');
        }
        notifyListeners();
        return true;
      } else {
        _error = result['message'];
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

  // Delete payment
  Future<bool> deletePayment(String paymentId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _paymentService.deleteScheduledPayment(paymentId);

      if (result['success'] == true) {
        // Remove from local state
        _scheduledPayments.removeWhere((p) => p.id == paymentId);
        notifyListeners();
        return true;
      } else {
        _error = result['message'];
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

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
