import 'api_service.dart';
import 'error_handler_service.dart';
import '../config/app_config.dart';

class LoanService {
  final ApiService _apiService;

  LoanService(this._apiService);

  // =================== APPLY FOR LOAN ===================
  Future<Map<String, dynamic>> applyForLoan({
    required double amount,
    required int termInMonths,
    required String purpose,
    double monthlyIncome = 1000,
    double existingDebt = 0,
    double collateralValue = 5000,
    int creditScore = 1100,
    String employmentStatus = "employed",
    int employmentDuration = 24,
    int bankStatementScore = 90,
    bool bvnVerified = true,
    bool ninVerified = true,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.loanEndpoint}/loans/applications',
        data: {
          "loan_amount": amount,
          "loan_purpose": purpose,
          "requested_term": termInMonths,
          "monthly_income": monthlyIncome,
          "existing_debt": existingDebt,
          "collateral_value": collateralValue,
          "credit_score": creditScore,
          "employment_status": employmentStatus,
          "employment_duration": employmentDuration,
          "bank_statement_score": bankStatementScore,
          "bvn_verified": bvnVerified,
          "nin_verified": ninVerified,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Loan application submitted',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'An unexpected error occurred while applying for loan.',
      };
    }
  }

  // =================== GET ALL LOANS ===================
  /// Matches web app: ${AppConfig.loanEndpoint}/applications
  Future<List<Map<String, dynamic>>> getAllLoans() async {
    try {
      // Web app endpoint: ${AppConfig.loanEndpoint}/applications
      final response = await _apiService.get(
        '${AppConfig.loanEndpoint}/loans/applications',
      );

      // Web app: response.data is the array directly, not wrapped in {success, data}
      if (response.statusCode == 200) {
        // Response is an array directly: [{...}, {...}]
        if (response.data is List) {
          return (response.data as List)
              .map((loan) => loan as Map<String, dynamic>)
              .toList();
        }
        // If wrapped in data field
        if (response.data is Map && response.data['data'] is List) {
          return (response.data['data'] as List)
              .map((loan) => loan as Map<String, dynamic>)
              .toList();
        }
        return [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  // =================== FETCH LOAN DETAILS ===================
  Future<Map<String, dynamic>> fetchLoanDetails(String loanId) async {
  final response = await _apiService.get(
    '${AppConfig.loanEndpoint}/loans/applications/$loanId',
  );

  final data = response.data;
  print("FETCH LOAN DETAILS RESPONSE: $data");

  if (response.statusCode == 200 ) {
    return Map<String, dynamic>.from(data);
  }

  throw Exception('Loan not found');
}
  // Get loan repayment schedule
  Future<Map<String, dynamic>> getRepaymentSchedule(String loanId) async {
    try {
      final response = await _apiService.get(
        '${AppConfig.loanEndpoint}/loans/$loanId/schedule',
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'An unexpected error occurred while fetching repayment schedule.',
      };
    }
  }
}
