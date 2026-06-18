import '../models/remittance_transfer.dart';
import '../config/app_config.dart';
import 'api_service.dart';

class RemittanceService {
  final ApiService _apiService;

  RemittanceService(this._apiService);

  static const String _base = AppConfig.remittanceEndpoint;

  Future<List<RemittanceTransfer>> getTransfers({
    int page = 1,
    int limit = 20,
    String? status,
    String? corridor,
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (status != null) params['status'] = status;
    if (corridor != null) params['corridor'] = corridor;

    final response = await _apiService.get('$_base/v1/transfers', queryParameters: params);
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems
        .whereType<Map<String, dynamic>>()
        .map(RemittanceTransfer.fromJson)
        .toList();
  }

  Future<RemittanceTransfer> getTransferById(String id) async {
    final response = await _apiService.get('$_base/v1/transfers/$id');
    return RemittanceTransfer.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<RemittanceTransfer> initiateTransfer({
    required String beneficiaryName,
    required String beneficiaryAccount,
    required String beneficiaryBank,
    required double amount,
    required String senderCurrency,
    required String beneficiaryCurrency,
    required String corridor,
    String? narration,
  }) async {
    final response = await _apiService.post('$_base/v1/transfers', data: {
      'beneficiary_name': beneficiaryName,
      'beneficiary_account': beneficiaryAccount,
      'beneficiary_bank': beneficiaryBank,
      'amount': amount,
      'sender_currency': senderCurrency,
      'beneficiary_currency': beneficiaryCurrency,
      'corridor': corridor,
      if (narration != null) 'narration': narration,
    });
    return RemittanceTransfer.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<Map<String, dynamic>> getExchangeRate({
    required String fromCurrency,
    required String toCurrency,
    required String corridor,
  }) async {
    final response = await _apiService.get('$_base/v1/exchange-rates', queryParameters: {
      'from': fromCurrency,
      'to': toCurrency,
      'corridor': corridor,
    });
    return Map<String, dynamic>.from(response.data);
  }

  Future<List<Map<String, dynamic>>> getCorridors() async {
    final response = await _apiService.get('$_base/v1/corridors');
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems.whereType<Map<String, dynamic>>().toList();
  }

  Future<Map<String, dynamic>> getStats({String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final response = await _apiService.get('$_base/v1/stats', queryParameters: params);
    return Map<String, dynamic>.from(response.data);
  }

  Future<List<Map<String, dynamic>>> getBeneficiaries() async {
    final response = await _apiService.get('$_base/v1/beneficiaries');
    final data = response.data;
    final rawItems = data is Map ? (data['items'] ?? data['data'] ?? []) : data;
    if (rawItems is! List) return [];
    return rawItems.whereType<Map<String, dynamic>>().toList();
  }
}
