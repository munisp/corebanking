import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../models/bnpl_application.dart';
import '../services/bnpl_service.dart';

enum BNPLStatus { initial, loading, loaded, error }

class BNPLProvider extends ChangeNotifier {
  final BNPLService _service = BNPLService();
  List<BNPLApplication> applications = [];
  BNPLStatus status = BNPLStatus.initial;
  String? errorMessage;

  Future<void> fetchApplications() async {
    status = BNPLStatus.loading;
    notifyListeners();
    try {
      final response = await _service.getApplications();
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final items = List<dynamic>.from(data['items'] ?? []);
        applications = items.map((e) => BNPLApplication.fromJson(e as Map<String, dynamic>)).toList();
        status = BNPLStatus.loaded;
      } else {
        errorMessage = 'Failed to load applications';
        status = BNPLStatus.error;
      }
    } on DioException catch (e) {
      errorMessage = e.message ?? 'Network error';
      status = BNPLStatus.error;
    } catch (e) {
      errorMessage = e.toString();
      status = BNPLStatus.error;
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> createApplication(Map<String, dynamic> data) async {
    try {
      final response = await _service.createApplication(data);
      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchApplications();
        return {'success': true};
      }
      return {'success': false, 'message': 'Failed to submit application'};
    } on DioException catch (e) {
      return {'success': false, 'message': e.message ?? 'Network error'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
