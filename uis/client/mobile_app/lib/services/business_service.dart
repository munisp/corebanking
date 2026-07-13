import '../config/app_config.dart';
import 'api_service.dart';

class BusinessService {
  final ApiService _apiService = ApiService();

  Future<List<Map<String, dynamic>>> getBusinesses() async {
    try {
      final response = await _apiService.get(
        '${AppConfig.businessEndpoint}/businesses?limit=100',
      );
      if (response.statusCode == 200) {
        final data = response.data;
        final list = data is Map ? (data['businesses'] ?? []) : [];
        return List<Map<String, dynamic>>.from(list);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> createBusiness({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phone,
    String? uin,
    required String businessName,
    required String tin,
    required String cac,
    String address = '',
    String city = '',
    String state = '',
    String postalCode = '',
  }) async {
    try {
      final payload = <String, dynamic>{
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
        'businessName': businessName,
        'tin': tin,
        'cac': cac,
        'address': address,
        'city': city,
        'state': state,
        'postalCode': postalCode,
      };

      if (uin != null && uin.isNotEmpty) payload['uin'] = uin;

      final response = await _apiService.post(
        '${AppConfig.orchestratorEndpoint}/business',
        data: payload,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data['data'] ?? response.data;
        return {
          'success': true,
          'data': data,
          'kybUrl': response.data['verification'] ?? data['verification'],
          'message': response.data['message'] ?? 'Business account created successfully',
        };
      }

      return {
        'success': false,
        'message': response.data['message'] ?? 'Failed to create business account',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error creating business account: $e',
      };
    }
  }
}
