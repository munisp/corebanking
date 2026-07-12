import 'package:dio/dio.dart';
import 'api_service.dart';

class TradeFinanceService {
  final ApiService _api = ApiService();

  // Letters of Credit  → /trade-finance/*  rewrites to /*  on trade-finance-go
  static const String _lcBase = '/trade-finance/api';
  // Bank Guarantees   → /bank-guarantees/* rewrites to /*  on bank-guarantees-go
  static const String _bgBase = '/bank-guarantees/v1/bank-guarantees';
  // Factoring         → /factoring/*       rewrites to /*  on factoring-go
  static const String _factoringBase = '/factoring/v1/factoring/deals';

  // --- Letters of Credit ---
  Future<Response> getLCs({int page = 1, int limit = 20}) async {
    return await _api.get('$_lcBase/list', queryParameters: {'page': page, 'limit': limit});
  }

  Future<Response> getLCById(String id) async {
    return await _api.get('$_lcBase/get', queryParameters: {'id': id});
  }

  Future<Response> createLC(Map<String, dynamic> data) async {
    return await _api.post('$_lcBase/create', data: data);
  }

  Future<Response> amendLC(String id, Map<String, dynamic> data) async {
    return await _api.post('$_lcBase/update', data: {'id': id, ...data});
  }

  // --- Bank Guarantees ---
  Future<Response> getBankGuarantees({int page = 1, int limit = 20}) async {
    return await _api.get('$_bgBase/list', queryParameters: {'page': page, 'limit': limit});
  }

  Future<Response> getBankGuaranteeById(String id) async {
    return await _api.get('$_bgBase/list', queryParameters: {'id': id});
  }

  Future<Response> createBankGuarantee(Map<String, dynamic> data) async {
    return await _api.post('$_bgBase/create', data: data);
  }

  Future<Response> extendBankGuarantee(String id, Map<String, dynamic> data) async {
    return await _api.post('$_bgBase/update', data: {'id': id, 'action': 'extend', ...data});
  }

  Future<Response> cancelBankGuarantee(String id) async {
    return await _api.post('$_bgBase/update', data: {'id': id, 'action': 'cancel'});
  }

  // --- Factoring ---
  Future<Response> getFactoringApplications({int page = 1, int limit = 20}) async {
    return await _api.get(_factoringBase, queryParameters: {'page': page, 'limit': limit});
  }

  Future<Response> createFactoringApplication(Map<String, dynamic> data) async {
    return await _api.post(_factoringBase, data: data);
  }

  Future<Response> getFactoringInvoices(String id) async {
    return await _api.get('$_factoringBase/$id/invoices');
  }
}
