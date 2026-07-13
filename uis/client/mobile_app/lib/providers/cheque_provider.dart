import 'package:flutter/material.dart';
import '../models/cheque.dart';
import '../services/cheque_service.dart';

class ChequeProvider extends ChangeNotifier {
  final ChequeService _chequeService;
  
  List<Cheque> _cheques = [];
  bool _isLoading = false;
  String? _error;

  ChequeProvider(this._chequeService);

  List<Cheque> get cheques => _cheques;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Get cheques filtered by status
  List<Cheque> getChequesByStatus(String status) {
    return _cheques.where((cheque) => cheque.status == status).toList();
  }

  // Fetch all cheques
  Future<void> fetchCheques({String? accountId}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _cheques = await _chequeService.getCheques(accountId: accountId);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Request new cheque book
  Future<bool> requestChequeBook({
    required String accountId,
    required int numberOfLeaves,
    required String deliveryMethod,
    String? deliveryAddress,
    String? branchName,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _chequeService.requestChequeBook(
        accountId: accountId,
        numberOfLeaves: numberOfLeaves,
        deliveryMethod: deliveryMethod,
        deliveryAddress: deliveryAddress,
        branchName: branchName,
      );

      if (result['success'] == true) {
        // Refresh cheques list
        await fetchCheques(accountId: accountId);
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

  // Stop cheque
  Future<bool> stopCheque({
    required String chequeId,
    required String reason,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _chequeService.stopCheque(
        chequeId: chequeId,
        reason: reason,
      );

      if (result['success'] == true) {
        // Update local state
        final index = _cheques.indexWhere((c) => c.id == chequeId);
        if (index != -1) {
          _cheques[index] = _cheques[index].copyWith(
            status: 'stopped',
            stopReason: reason,
            stopDate: DateTime.now(),
          );
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

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
