import 'package:flutter/foundation.dart';
import '../models/enaira_wallet.dart';
import '../services/enaira_service.dart';

class EnairaProvider extends ChangeNotifier {
  final EnairaService _service;

  EnairaProvider(this._service);

  List<EnairaWallet> _wallets = [];
  Map<String, dynamic> _stats = {};
  bool _isLoading = false;
  String? _error;

  List<EnairaWallet> get wallets => _wallets;
  Map<String, dynamic> get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchWallets({String? status}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _wallets = await _service.getWallets(status: status);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchStats() async {
    try {
      _stats = await _service.getStats();
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> fundWallet({required String walletId, required double amount}) async {
    try {
      await _service.fundWallet(walletId: walletId, amount: amount);
      await fetchWallets();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> transfer({
    required String fromWalletId,
    required String toWalletId,
    required double amount,
    String? narration,
  }) async {
    try {
      await _service.transfer(
        fromWalletId: fromWalletId,
        toWalletId: toWalletId,
        amount: amount,
        narration: narration,
      );
      await fetchWallets();
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
