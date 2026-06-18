import 'package:flutter/foundation.dart';
import '../models/remittance_transfer.dart';
import '../services/remittance_service.dart';

class RemittanceProvider extends ChangeNotifier {
  final RemittanceService _service;

  RemittanceProvider(this._service);

  List<RemittanceTransfer> _transfers = [];
  List<Map<String, dynamic>> _corridors = [];
  List<Map<String, dynamic>> _beneficiaries = [];
  Map<String, dynamic> _stats = {};
  bool _isLoading = false;
  String? _error;

  List<RemittanceTransfer> get transfers => _transfers;
  List<Map<String, dynamic>> get corridors => _corridors;
  List<Map<String, dynamic>> get beneficiaries => _beneficiaries;
  Map<String, dynamic> get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchTransfers({String? status, String? corridor}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _transfers = await _service.getTransfers(status: status, corridor: corridor);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchCorridors() async {
    try {
      _corridors = await _service.getCorridors();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> fetchBeneficiaries() async {
    try {
      _beneficiaries = await _service.getBeneficiaries();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> fetchStats() async {
    try {
      _stats = await _service.getStats();
      notifyListeners();
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> getExchangeRate({
    required String fromCurrency,
    required String toCurrency,
    required String corridor,
  }) async {
    try {
      return await _service.getExchangeRate(
        fromCurrency: fromCurrency,
        toCurrency: toCurrency,
        corridor: corridor,
      );
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    }
  }

  Future<bool> initiateTransfer({
    required String beneficiaryName,
    required String beneficiaryAccount,
    required String beneficiaryBank,
    required double amount,
    required String senderCurrency,
    required String beneficiaryCurrency,
    required String corridor,
    String? narration,
  }) async {
    try {
      await _service.initiateTransfer(
        beneficiaryName: beneficiaryName,
        beneficiaryAccount: beneficiaryAccount,
        beneficiaryBank: beneficiaryBank,
        amount: amount,
        senderCurrency: senderCurrency,
        beneficiaryCurrency: beneficiaryCurrency,
        corridor: corridor,
        narration: narration,
      );
      await fetchTransfers();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
