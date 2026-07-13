library;
import '../models/user.dart';
import 'user_service.dart';
import 'dart:async';

import 'api_service.dart';
import '../models/escrow.dart';

class EscrowService {
   /// Get user details from local storage
    Future<User?> getLocalUser() async {
      final userService = UserService();
      final user = await userService.getStoredUserII();
      print(    '🌐 Retrieved local user: $user.');
      return user;
    }
  static final EscrowService instance = EscrowService._();
  final ApiService _apiClient = ApiService();
  EscrowService._();

  // List contracts (paginated)
  Future<List<Escrow>> listContracts({
    int page = 1,
    int perPage = 20,
    String? status,
    String? useCase,
    String? userId,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
      if (status != null) 'status': status,
      if (useCase != null) 'use_case': useCase,
      if (userId != null) 'user_id': userId,
    };
    final response = await _apiClient.get('/escrow/api/v1/escrow/contracts', queryParameters: queryParams);
    final itemsRaw = (response.data['data'] ?? response.data) as List? ?? [];
    return itemsRaw.map((item) => Escrow.fromJson(item)).toList();
  }

  // Get contract details
  Future<Escrow> getContract(String contractId) async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/contracts/$contractId');
    return Escrow.fromJson(response.data['data'] ?? response.data);
  }

  // Create contract
  Future<Escrow> createContract(Map<String, dynamic> input) async {
    User? user;
      user = await getLocalUser();
      if (user == null || user.id.isEmpty) {
        throw Exception('No valid local user found');
      }
      input['user_id'] = user.id;
    final response = await _apiClient.post('/escrow/api/v1/escrow/contracts', data: input);
    return Escrow.fromJson(response.data['data'] ?? response.data);
  }

  // Fund contract
  Future<Map<String, dynamic>> fundContract(String contractId, double amount, String fundingSource, String reference) async {
    final payload = {
      'amount': amount,
      'funding_source': fundingSource,
      'reference': reference,
    };
    final response = await _apiClient.post('/escrow/api/v1/escrow/contracts/$contractId/fund', data: payload);
    return response.data['data'] ?? response.data;
  }

  // Release contract
  Future<Map<String, dynamic>> releaseContract(String contractId, String notes) async {
    final payload = {'notes': notes};
    final response = await _apiClient.post('/escrow/api/v1/escrow/contracts/$contractId/release', data: payload);
    return response.data['data'] ?? response.data;
  }

  // Refund contract
  Future<Map<String, dynamic>> refundContract(String contractId, String reason) async {
    final payload = {'reason': reason};
    final response = await _apiClient.post('/escrow/api/v1/escrow/contracts/$contractId/refund', data: payload);
    return response.data['data'] ?? response.data;
  }

  // Raise dispute
  Future<Map<String, dynamic>> raiseDispute(String contractId, Map<String, dynamic> input) async {
    final response = await _apiClient.post('/escrow/api/v1/escrow/contracts/$contractId/dispute', data: input);
    return response.data['data'] ?? response.data;
  }

  // List milestones
  Future<List<Map<String, dynamic>>> listMilestones({int page = 1, int perPage = 20}) async {
    final queryParams = {'page': page, 'per_page': perPage};
    final response = await _apiClient.get('/escrow/api/v1/escrow/milestones', queryParameters: queryParams);
    final itemsRaw = (response.data['data'] ?? response.data) as List? ?? [];
    return itemsRaw.cast<Map<String, dynamic>>();
  }

  // Get milestone
  Future<Map<String, dynamic>> getMilestone(String milestoneId) async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/milestones/$milestoneId');
    return response.data['data'] ?? response.data;
  }

  // Update milestone
  Future<Map<String, dynamic>> updateMilestone(String milestoneId, Map<String, dynamic> input) async {
    final response = await _apiClient.put('/escrow/api/v1/escrow/milestones/$milestoneId', data: input);
    return response.data['data'] ?? response.data;
  }

  // Delete milestone
  Future<void> deleteMilestone(String milestoneId) async {
    await _apiClient.delete('/escrow/api/v1/escrow/milestones/$milestoneId');
  }

  // List disputes
  Future<List<Map<String, dynamic>>> listDisputes({int page = 1, int perPage = 20, String? status}) async {
    final queryParams = {'page': page, 'per_page': perPage, if (status != null) 'status': status};
    final response = await _apiClient.get('/escrow/api/v1/escrow/disputes', queryParameters: queryParams);
    final itemsRaw = (response.data['data'] ?? response.data) as List? ?? [];
    return itemsRaw.cast<Map<String, dynamic>>();
  }

  // Get dispute
  Future<Map<String, dynamic>> getDispute(String disputeId) async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/disputes/$disputeId');
    return response.data['data'] ?? response.data;
  }

  // Resolve dispute
  Future<Map<String, dynamic>> resolveDispute(String disputeId, Map<String, dynamic> input) async {
    final response = await _apiClient.post('/escrow/api/v1/escrow/disputes/$disputeId/resolve', data: input);
    return response.data['data'] ?? response.data;
  }

  // Escalate dispute
  Future<Map<String, dynamic>> escalateDispute(String disputeId, String reason) async {
    final payload = {'reason': reason};
    final response = await _apiClient.post('/escrow/api/v1/escrow/disputes/$disputeId/escalate', data: payload);
    return response.data['data'] ?? response.data;
  }

  // List templates
  Future<List<Map<String, dynamic>>> listTemplates() async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/templates');
    final itemsRaw = (response.data['data'] ?? response.data) as List? ?? [];
    return itemsRaw.cast<Map<String, dynamic>>();
  }

  // Get template
  Future<Map<String, dynamic>> getTemplate(String templateId) async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/templates/$templateId');
    return response.data['data'] ?? response.data;
  }

  // Create template
  Future<Map<String, dynamic>> createTemplate(Map<String, dynamic> input) async {
    final response = await _apiClient.post('/escrow/api/v1/escrow/templates', data: input);
    return response.data['data'] ?? response.data;
  }

  // Update template
  Future<Map<String, dynamic>> updateTemplate(String templateId, Map<String, dynamic> input) async {
    final response = await _apiClient.put('/escrow/api/v1/escrow/templates/$templateId', data: input);
    return response.data['data'] ?? response.data;
  }

  // Delete template
  Future<void> deleteTemplate(String templateId) async {
    await _apiClient.delete('/escrow/api/v1/escrow/templates/$templateId');
  }

  // Get summary report
  Future<Map<String, dynamic>> getSummaryReport() async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/reports/summary');
    return response.data['data'] ?? response.data;
  }

  // Get volume report
  Future<Map<String, dynamic>> getVolumeReport({String? startDate, String? endDate, String? groupBy}) async {
    final queryParams = <String, dynamic>{
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (groupBy != null) 'group_by': groupBy,
    };
    final response = await _apiClient.get('/escrow/api/v1/escrow/reports/volume', queryParameters: queryParams);
    return response.data['data'] ?? response.data;
  }

  // Get dispute report
  Future<Map<String, dynamic>> getDisputeReport({String? startDate, String? endDate}) async {
    final queryParams = <String, dynamic>{
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
    };
    final response = await _apiClient.get('/escrow/api/v1/escrow/reports/disputes', queryParameters: queryParams);
    return response.data['data'] ?? response.data;
  }

  // Get fee report
  Future<Map<String, dynamic>> getFeeReport({String? startDate, String? endDate}) async {
    final queryParams = <String, dynamic>{
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
    };
    final response = await _apiClient.get('/escrow/api/v1/escrow/reports/fees', queryParameters: queryParams);
    return response.data['data'] ?? response.data;
  }

  // Get aging report
  Future<Map<String, dynamic>> getAgingReport() async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/reports/aging');
    return response.data['data'] ?? response.data;
  }

  // List webhooks
  Future<List<Map<String, dynamic>>> listWebhooks() async {
    final response = await _apiClient.get('/escrow/api/v1/escrow/webhooks');
    final itemsRaw = (response.data['data'] ?? response.data) as List? ?? [];
    return itemsRaw.cast<Map<String, dynamic>>();
  }

  // Register webhook
  Future<Map<String, dynamic>> registerWebhook(Map<String, dynamic> input) async {
    final response = await _apiClient.post('/escrow/api/v1/escrow/webhooks', data: input);
    return response.data['data'] ?? response.data;
  }

  // Delete webhook
  Future<void> deleteWebhook(String webhookId) async {
    await _apiClient.delete('/escrow/api/v1/escrow/webhooks/$webhookId');
  }
}
