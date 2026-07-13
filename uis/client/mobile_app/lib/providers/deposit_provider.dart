import 'package:flutter/foundation.dart';
import '../services/wallet_service.dart';
import '../services/api_service.dart';


class DepositProvider with ChangeNotifier {
  final WalletService _walletService = WalletService(ApiService());

  bool _isDepositing = false;
  String? _errorMessage;

  bool get isLoading => _isDepositing; // expose consistent getter
  String? get errorMessage => _errorMessage;

  Future<bool> depositFunds({required double amount, required String method}) async {
    _isDepositing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _walletService.depositFunds(amount, method);
      _isDepositing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isDepositing = false;
      notifyListeners();
      return false;
    }
  }
}
