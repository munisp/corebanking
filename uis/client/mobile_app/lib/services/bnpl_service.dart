import 'package:dio/dio.dart';
import 'api_service.dart';

class BNPLService {
  final ApiService _api = ApiService();
  static const String _endpoint = '/bnpl/v1/applications';

  Future<Response> createApplication(Map<String, dynamic> data) async {
    return await _api.post(_endpoint, data: data);
  }

  Future<Response> getApplications() async {
    return await _api.get(_endpoint);
  }

  Future<Response> getApplicationById(String id) async {
    return await _api.get('$_endpoint/$id');
  }

  Future<Response> getRepaymentSchedule(String id) async {
    return await _api.get('$_endpoint/$id/schedule');
  }

  Future<Response> recordRepayment(String id, int installmentNo) async {
    return await _api.post('$_endpoint/$id/repayment', data: {'installment_no': installmentNo});
  }
}
