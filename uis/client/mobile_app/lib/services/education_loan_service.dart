
import 'package:dio/dio.dart';
import 'api_service.dart';

class EducationLoanService {
  final ApiService _api = ApiService();
  static const String _endpoint = '/education-loan/applications';

  Future<Response> applyForLoan(Map<String, dynamic> data) async {
    return await _api.post(_endpoint, data: data);
  }

  Future<Response> makeRepayment({
  required String loanId,
  required double amount,
  required String pin,
}) async {
  return await _api.post(
    '/education-loan/repayment',
    data: {
      "loan_id": loanId,
      "amount": amount,
      "pin": pin,
    },
  );
}

  Future<Response> getApplications() async {
    return await _api.get(_endpoint);
  }

  Future<Response> getApplicationById(String id) async {
    return await _api.get('$_endpoint/$id');
  }

  Future<Response> updateApplicationById(String id, Map<String, dynamic> data) async {
    return await _api.put('$_endpoint/$id', data: data);
  }

  Future<Response> submitApplication(String id, {Map<String, dynamic>? data}) async {
    return await _api.post('$_endpoint/$id/submit', data: data);
  }

  Future<Response> getDisbursementSchedule(String id) async {
    return await _api.get('$_endpoint/$id/disbursement-schedule');
  }

  Future<Response> acceptOffer(String id) async {
    return await _api.post('$_endpoint/$id/accept-offer');
  }

  Future<Response> rejectOffer(String id) async {
    return await _api.post('$_endpoint/$id/reject-offer');
  }

  Future<Response> getInstitutions({String? type, String? state}) async {
    final queryParams = <String>[];
    if (type != null && type.isNotEmpty) queryParams.add('type=$type');
    if (state != null && state.isNotEmpty) queryParams.add('state=$state');
    final query = queryParams.isEmpty ? '' : '?${queryParams.join('&')}';
    return await _api.get('/education-loan/institutions$query');
  }
}
