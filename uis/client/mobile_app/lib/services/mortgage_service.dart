
import 'api_service.dart';
import '../models/mortgage.dart';
import '../config/app_config.dart';

class MortgageService {
  static final MortgageService instance = MortgageService._();
  final ApiService _apiClient = ApiService();

  MortgageService._();

  Future<List<Mortgage>> getMortgages({int page = 1, int pageSize = 20}) async {
    final response = await _apiClient.getPaginated(
      '${AppConfig.mortgageEndpoint}/applications',
      page: page,
      pageSize: pageSize,
      fromJson: (json) => Mortgage.fromJson(json),
    );
    return response.items;
  }

  Future<Mortgage> getMortgage(String id) async {
    final response = await _apiClient.get(
      '${AppConfig.mortgageEndpoint}/applications/$id',
    );
    return Mortgage.fromJson(response.data);
  }

  /// Sends mortgage application data as-is (already in snake_case from the screen).
  Future<void> applyForMortgage(Map<String, dynamic> data) async {
    await _apiClient.post(
      '${AppConfig.mortgageEndpoint}/applications',
      data: data,
    );
  }

  Future<void> makeRepayment(String mortgageId, Map<String, dynamic> data) async {
    await _apiClient.post(
      '${AppConfig.mortgageEndpoint}/$mortgageId/payments',
      data: data,
    );
  }

  Future<List<dynamic>> getRepaymentSchedule(String mortgageId) async {
    final response = await _apiClient.get(
      '${AppConfig.mortgageEndpoint}/$mortgageId/schedule',
    );
    return response.data['schedule'] ?? [];
  }
}