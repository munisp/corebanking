import '../models/enaira_wallet.dart';
import '../config/app_config.dart';
import 'api_service.dart';

class EnairaService {
  final ApiService _apiService;

  EnairaService(this._apiService);

  static const String _base = AppConfig.enairaCbdcEndpoint;

  Future<List<EnairaWallet>> getWallets({int page = 1, int limit = 20, String? status}) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (status != null) params['status'] = status;

    final response = await _apiService.get('$_base/v1/wallets', queryParameters: params);
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems
        .whereType<Map<String, dynamic>>()
        .map(EnairaWallet.fromJson)
        .toList();
  }

  Future<EnairaWallet> getWalletById(String id) async {
    final response = await _apiService.get('$_base/v1/wallets/$id');
    return EnairaWallet.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<EnairaWallet> createWallet(Map<String, dynamic> body) async {
    final response = await _apiService.post('$_base/v1/wallets', data: body);
    return EnairaWallet.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<Map<String, dynamic>> fundWallet({
    required String walletId,
    required double amount,
  }) async {
    final response = await _apiService.post('$_base/v1/wallets/$walletId/fund', data: {
      'amount': amount,
    });
    return Map<String, dynamic>.from(response.data);
  }

  Future<Map<String, dynamic>> transfer({
    required String fromWalletId,
    required String toWalletId,
    required double amount,
    String? narration,
  }) async {
    final response = await _apiService.post('$_base/v1/transfers', data: {
      'from_wallet_id': fromWalletId,
      'to_wallet_id': toWalletId,
      'amount': amount,
      if (narration != null) 'narration': narration,
    });
    return Map<String, dynamic>.from(response.data);
  }

  Future<Map<String, dynamic>> getStats() async {
    final response = await _apiService.get('$_base/v1/stats');
    return Map<String, dynamic>.from(response.data);
  }

  Future<List<Map<String, dynamic>>> getTransactions(String walletId, {int page = 1, int limit = 20}) async {
    final response = await _apiService.get(
      '$_base/v1/wallets/$walletId/transactions',
      queryParameters: {'page': page, 'limit': limit},
    );
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems.whereType<Map<String, dynamic>>().toList();
  }
}
