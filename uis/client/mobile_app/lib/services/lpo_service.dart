// ...existing code...
import 'api_service.dart';
import 'error_handler_service.dart';
import '../config/app_config.dart';

class LPOService {
  final ApiService _apiService;

  LPOService(this._apiService);

  // =================== APPLY FOR LPO ===================
  /// Matches web app: ${AppConfig.lpoEndpoint}/lpo/apply
  Future<Map<String, dynamic>> applyForLPO({
    required String supplierId,
    required String tenantId,
    required String lpoNumber,
    required String issuingOrganization,
    required double lpoAmount,
    required double financingAmount,
    required int repaymentDays,
    String lpoDocumentUrl = "",
  }) async {
    try {
      // Web app endpoint: ${AppConfig.lpoEndpoint}/lpo/apply
      final response = await _apiService.post(
        '${AppConfig.lpoEndpoint}/lpo/apply',
        data: {
          "supplier_id": supplierId,
          "tenant_id": tenantId,
          "lpo_number": lpoNumber,
          "issuing_organization": issuingOrganization,
          "lpo_amount": lpoAmount,
          "financing_amount": financingAmount,
          "repayment_days": repaymentDays,
          "lpo_document_url": lpoDocumentUrl,
        },
      );

      // Web app: response.status === 200 || response.status === 201, returns response.data.data
      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'message': 'LPO application submitted successfully',
          'data': response.data['data'] ?? response.data,
        };
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== GET ALL LPOs ===================
  /// Matches web app: ${AppConfig.lpoEndpoint}/lpo
  Future<List<Map<String, dynamic>>> getAllLPOs() async {
    try {
      // Web app endpoint: ${AppConfig.lpoEndpoint}/lpo
      final response = await _apiService.get(
        '${AppConfig.lpoEndpoint}/lpo',
      );

      // Web app: response.data is the array directly, not wrapped in {success, data}
      if (response.statusCode == 200) {
        // Response is an array directly: [{...}, {...}]
        if (response.data is List) {
          return (response.data as List)
              .map((lpo) => lpo as Map<String, dynamic>)
              .toList();
        }
        // If wrapped in data field
        if (response.data is Map && response.data['data'] is List) {
          return (response.data['data'] as List)
              .map((lpo) => lpo as Map<String, dynamic>)
              .toList();
        }
        return [];
      }
      return [];
    } catch (e) {
      // ...existing code...
      return [];
    }
  }

  // =================== FETCH LPO DETAILS ===================
  /// Matches web app: ${AppConfig.lpoEndpoint}/application/${lpoId}
  Future<Map<String, dynamic>> fetchLPODetails(String lpoId) async {
    try {
      // Web app endpoint: ${AppConfig.lpoEndpoint}/application/${lpoId}
      final response = await _apiService.get(
        '${AppConfig.lpoEndpoint}/lpo/$lpoId',
      );

      if (response.statusCode == 200) {
        // Web app: returns response.data directly
        print('LPO details fetched successfully: ${response.data}');
        return response.data as Map<String, dynamic>;
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }
}
