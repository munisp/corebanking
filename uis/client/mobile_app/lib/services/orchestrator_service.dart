import '../config/app_config.dart';
import 'api_service.dart';

class OrchestratorService {
  final ApiService _apiService;

  OrchestratorService(this._apiService);

  // Create customer (with full onboarding data)
  Future<Map<String, dynamic>> createCustomer({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phoneNumber,
    String? pin, // Make PIN optional - user can set it later in settings
    String? accountType,
    String? bvn,
    String? uin,
    String? address,
    String? city,
    String? state,
    String? postalCode,
    String? country,
  }) async {
    try {
      final customerData = <String, dynamic>{
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phoneNumber,
        if (pin != null && pin.isNotEmpty) 'pin': pin, // Only include PIN if provided
        if (accountType != null) 'accountType': accountType,
        if (bvn != null && bvn.isNotEmpty) 'bvn': bvn,
        if (uin != null && uin.isNotEmpty) 'uin': uin,
        'address': address ?? '',
        'city': city ?? '',
        'state': state ?? '',
        'postalCode': postalCode ?? '',
        'country': country ?? 'Nigeria',
      };

      final response = await _apiService.post(
        '${AppConfig.orchestratorEndpoint}/customer',
        data: customerData,
      );

      // Check if customer creation was successful
      if (response.statusCode == 201 || response.statusCode == 200) {
        // Setup PIN after customer creation only if PIN was provided (matching web app)
        if (pin != null && pin.isNotEmpty) {
          try {
            await _apiService.post(
              '${AppConfig.accountEndpoint}/setup-pin',
              data: {
                'pin': pin,
              },
            );
          } catch (e) {
            print('[Orchestrator Service] Failed to setup PIN: $e');
            // Continue even if PIN setup fails
          }
        }
        
        return {
          'success': true,
          'data': response.data['data'] ?? response.data['customer'],
          'message': response.data['message'] ?? 'Customer created successfully',
        };
      }
      return {
        'success': false,
        'message': response.data['message'] ?? 'Failed to create customer',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error creating customer: $e',
      };
    }
  }

  // Get customer by ID
  Future<Map<String, dynamic>> getCustomer(String customerId) async {
    try {
      final response = await _apiService.get(
        '${AppConfig.orchestratorEndpoint}/customer/$customerId',
      );
      if (response.statusCode == 200) {
        return {
          'success': true,
          'data': response.data['data'] ?? response.data['customer'],
        };
      }
      return {
        'success': false,
        'message': response.data['message'] ?? 'Failed to fetch customer',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error fetching customer: $e',
      };
    }
  }

  // Update customer
  Future<Map<String, dynamic>> updateCustomer(
    String customerId, {
    String? firstName,
    String? lastName,
    String? phoneNumber,
    String? address,
    String? city,
    String? state,
    String? country,
  }) async {
    try {
      final updateData = <String, dynamic>{};
      if (firstName != null) updateData['first_name'] = firstName;
      if (lastName != null) updateData['last_name'] = lastName;
      if (phoneNumber != null) updateData['phone_number'] = phoneNumber;
      if (address != null) updateData['address'] = address;
      if (city != null) updateData['city'] = city;
      if (state != null) updateData['state'] = state;
      if (country != null) updateData['country'] = country;

      final response = await _apiService.put(
        '${AppConfig.orchestratorEndpoint}/customer/$customerId',
        data: updateData,
      );

      if (response.statusCode == 200) {
        return {
          'success': true,
          'data': response.data['data'] ?? response.data['customer'],
          'message': response.data['message'] ?? 'Customer updated successfully',
        };
      }
      return {
        'success': false,
        'message': response.data['message'] ?? 'Failed to update customer',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Error updating customer: $e',
      };
    }
  }

  // Health check
  Future<Map<String, dynamic>> healthCheck() async {
    try {
      final response = await _apiService.get('${AppConfig.orchestratorEndpoint}/health');
      return {
        'success': response.statusCode == 200,
        'message': response.data['message'] ?? 'Service is healthy',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Health check failed: $e',
      };
    }
  }
}
