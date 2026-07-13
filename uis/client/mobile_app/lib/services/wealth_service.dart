import '../models/wealth_portfolio.dart';
import '../config/app_config.dart';
import 'api_service.dart';

class WealthService {
  final ApiService _apiService;

  WealthService(this._apiService);

  static const String _base = AppConfig.wealthEndpoint;

  Future<List<WealthPortfolio>> getPortfolios({
    int page = 1,
    int limit = 20,
    String? status,
    String? strategy,
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (status != null) params['status'] = status;
    if (strategy != null) params['strategy'] = strategy;

    final response = await _apiService.get('$_base/v1/portfolios', queryParameters: params);
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems
        .whereType<Map<String, dynamic>>()
        .map(WealthPortfolio.fromJson)
        .toList();
  }

  Future<WealthPortfolio> getPortfolioById(String id) async {
    final response = await _apiService.get('$_base/v1/portfolios/$id');
    return WealthPortfolio.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<WealthPortfolio> createPortfolio(Map<String, dynamic> body) async {
    final response = await _apiService.post('$_base/v1/portfolios', data: body);
    return WealthPortfolio.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<WealthPortfolio> updatePortfolio(String id, Map<String, dynamic> body) async {
    final response = await _apiService.put('$_base/v1/portfolios/$id', data: body);
    return WealthPortfolio.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<List<Map<String, dynamic>>> getPortfolioHoldings(String id) async {
    final response = await _apiService.get('$_base/v1/portfolios/$id/holdings');
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems.whereType<Map<String, dynamic>>().toList();
  }

  Future<List<Map<String, dynamic>>> getPortfolioPerformance(String id, {String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final response = await _apiService.get('$_base/v1/portfolios/$id/performance', queryParameters: params);
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems.whereType<Map<String, dynamic>>().toList();
  }

  Future<List<Map<String, dynamic>>> getClients({int page = 1, int limit = 20}) async {
    final response = await _apiService.get('$_base/v1/clients', queryParameters: {
      'page': page,
      'limit': limit,
    });
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems.whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> getInvestmentOptions() async {
    final response = await _apiService.get('$_base/v1/investment-options');
    return Map<String, dynamic>.from(response.data);
  }

  Future<Map<String, dynamic>> getDashboard() async {
    final response = await _apiService.get('$_base/v1/dashboard');
    return Map<String, dynamic>.from(response.data);
  }
}
