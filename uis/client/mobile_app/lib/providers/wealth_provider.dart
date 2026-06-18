import 'package:flutter/foundation.dart';
import '../models/wealth_portfolio.dart';
import '../services/wealth_service.dart';

class WealthProvider extends ChangeNotifier {
  final WealthService _service;

  WealthProvider(this._service);

  List<WealthPortfolio> _portfolios = [];
  Map<String, dynamic> _dashboard = {};
  Map<String, dynamic> _investmentOptions = {};
  bool _isLoading = false;
  String? _error;

  List<WealthPortfolio> get portfolios => _portfolios;
  Map<String, dynamic> get dashboard => _dashboard;
  Map<String, dynamic> get investmentOptions => _investmentOptions;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchPortfolios({String? status, String? strategy}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _portfolios = await _service.getPortfolios(status: status, strategy: strategy);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchDashboard() async {
    try {
      _dashboard = await _service.getDashboard();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> fetchInvestmentOptions() async {
    try {
      _investmentOptions = await _service.getInvestmentOptions();
      notifyListeners();
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> getHoldings(String portfolioId) async {
    try {
      return await _service.getPortfolioHoldings(portfolioId);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getPerformance(String portfolioId, {String? from, String? to}) async {
    try {
      return await _service.getPortfolioPerformance(portfolioId, from: from, to: to);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return [];
    }
  }

  Future<bool> createPortfolio(Map<String, dynamic> body) async {
    try {
      final portfolio = await _service.createPortfolio(body);
      _portfolios.insert(0, portfolio);
      notifyListeners();
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
