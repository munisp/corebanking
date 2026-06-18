import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../models/trade_finance.dart';
import '../services/trade_finance_service.dart';

enum TradeFinanceStatus { initial, loading, loaded, error }

class TradeFinanceProvider extends ChangeNotifier {
  final TradeFinanceService _service = TradeFinanceService();

  // Letters of Credit
  List<LetterOfCredit> lcs = [];
  TradeFinanceStatus lcStatus = TradeFinanceStatus.initial;
  String? lcError;

  // Bank Guarantees
  List<BankGuarantee> guarantees = [];
  TradeFinanceStatus bgStatus = TradeFinanceStatus.initial;
  String? bgError;

  // Factoring
  List<FactoringApplication> factoringApps = [];
  TradeFinanceStatus factoringStatus = TradeFinanceStatus.initial;
  String? factoringError;

  // --- Letters of Credit ---
  Future<void> fetchLCs() async {
    lcStatus = TradeFinanceStatus.loading;
    lcError = null;
    notifyListeners();
    try {
      final response = await _service.getLCs();
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final items = List<dynamic>.from(
            data['items'] ?? data['data'] ?? data['lcs'] ?? []);
        lcs = items
            .map((e) => LetterOfCredit.fromJson(e as Map<String, dynamic>))
            .toList();
        lcStatus = TradeFinanceStatus.loaded;
      } else {
        lcError = 'Failed to load letters of credit';
        lcStatus = TradeFinanceStatus.error;
      }
    } on DioException catch (e) {
      lcError = e.message ?? 'Network error';
      lcStatus = TradeFinanceStatus.error;
    } catch (e) {
      lcError = e.toString();
      lcStatus = TradeFinanceStatus.error;
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> createLC(Map<String, dynamic> data) async {
    try {
      final response = await _service.createLC(data);
      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchLCs();
        return {'success': true};
      }
      return {'success': false, 'message': 'Failed to submit LC application'};
    } on DioException catch (e) {
      return {'success': false, 'message': e.message ?? 'Network error'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- Bank Guarantees ---
  Future<void> fetchGuarantees() async {
    bgStatus = TradeFinanceStatus.loading;
    bgError = null;
    notifyListeners();
    try {
      final response = await _service.getBankGuarantees();
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final items = List<dynamic>.from(
            data['records'] ?? data['items'] ?? data['guarantees'] ?? data['data'] ?? []);
        guarantees = items
            .map((e) => BankGuarantee.fromJson(e as Map<String, dynamic>))
            .toList();
        bgStatus = TradeFinanceStatus.loaded;
      } else {
        bgError = 'Failed to load bank guarantees';
        bgStatus = TradeFinanceStatus.error;
      }
    } on DioException catch (e) {
      bgError = e.message ?? 'Network error';
      bgStatus = TradeFinanceStatus.error;
    } catch (e) {
      bgError = e.toString();
      bgStatus = TradeFinanceStatus.error;
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> createGuarantee(Map<String, dynamic> data) async {
    try {
      final response = await _service.createBankGuarantee(data);
      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchGuarantees();
        return {'success': true};
      }
      return {'success': false, 'message': 'Failed to submit guarantee request'};
    } on DioException catch (e) {
      return {'success': false, 'message': e.message ?? 'Network error'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- Factoring ---
  Future<void> fetchFactoringApps() async {
    factoringStatus = TradeFinanceStatus.loading;
    factoringError = null;
    notifyListeners();
    try {
      final response = await _service.getFactoringApplications();
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final items = List<dynamic>.from(
            data['items'] ?? data['data'] ?? data['applications'] ?? []);
        factoringApps = items
            .map((e) => FactoringApplication.fromJson(e as Map<String, dynamic>))
            .toList();
        factoringStatus = TradeFinanceStatus.loaded;
      } else {
        factoringError = 'Failed to load factoring applications';
        factoringStatus = TradeFinanceStatus.error;
      }
    } on DioException catch (e) {
      factoringError = e.message ?? 'Network error';
      factoringStatus = TradeFinanceStatus.error;
    } catch (e) {
      factoringError = e.toString();
      factoringStatus = TradeFinanceStatus.error;
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> createFactoringApp(Map<String, dynamic> data) async {
    try {
      final response = await _service.createFactoringApplication(data);
      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchFactoringApps();
        return {'success': true};
      }
      return {'success': false, 'message': 'Failed to submit factoring application'};
    } on DioException catch (e) {
      return {'success': false, 'message': e.message ?? 'Network error'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
