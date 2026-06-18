import '../models/insurance_policy.dart';
import '../models/insurance_policy_application.dart';
import '../models/insurance_claim.dart';
import '../models/insurance_premium_payment.dart';
import '../models/etherisc_policy.dart';
import 'api_service.dart';
import 'error_handler_service.dart';

class InsuranceService {
  final ApiService _apiService = ApiService();

  // Get all Etherisc policy templates
  Future<List<EtheriscPolicy>> getAllEtheriscPolicies() async {
    try {
      final response = await _apiService.get('/etherisc/api/v1/etherisc/policies/all');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic policiesData;
        
        if (data is Map && data.containsKey('policies')) {
          policiesData = data['policies'];
        } else if (data is List) {
          policiesData = data;
        } else if (data is Map && data.containsKey('data')) {
          final innerData = data['data'];
          if (innerData is Map && innerData.containsKey('policies')) {
            policiesData = innerData['policies'];
          } else {
            policiesData = innerData;
          }
        } else {
          policiesData = data;
        }
        
        if (policiesData is String || policiesData == null) {
          return [];
        }
        
        if (policiesData is! List) {
          if (policiesData is Map) {
            policiesData = [policiesData];
          } else {
            return [];
          }
        }
        
        return policiesData.map((json) {
          if (json is Map<String, dynamic>) {
            return EtheriscPolicy.fromJson(json);
          } else if (json is Map) {
            return EtheriscPolicy.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid policy data format');
          }
        }).toList();
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get all available insurance policies (old endpoint - kept for compatibility)
  Future<List<InsurancePolicy>> getAllPolicies() async {
    try {
      final response = await _apiService.get('/insurance/api/v1/insurance/policies/all');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic policiesData;
        
        if (data is Map && data.containsKey('policies')) {
          policiesData = data['policies'];
        } else if (data is List) {
          policiesData = data;
        } else if (data is Map && data.containsKey('data')) {
          final innerData = data['data'];
          if (innerData is Map && innerData.containsKey('policies')) {
            policiesData = innerData['policies'];
          } else {
            policiesData = innerData;
          }
        } else {
          policiesData = data;
        }
        
        if (policiesData is String || policiesData == null) {
          return [];
        }
        
        if (policiesData is! List) {
          if (policiesData is Map) {
            policiesData = [policiesData];
          } else {
            return [];
          }
        }
        
        return policiesData.map((json) {
          if (json is Map<String, dynamic>) {
            return InsurancePolicy.fromJson(json);
          } else if (json is Map) {
            return InsurancePolicy.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid policy data format');
          }
        }).toList();
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Apply for insurance policy
  Future<InsurancePolicy> applyForPolicy({
    required String policyType,
    required double coverageAmount,
    required int durationMonths,
    List<dynamic> beneficiaries = const [],
    Map<String, dynamic>? additionalInfo,
  }) async {
    try {
      final application = InsurancePolicyApplication(
        policyType: policyType,
        coverageAmount: coverageAmount,
        durationMonths: durationMonths,
        beneficiaries: beneficiaries,
        additionalInfo: additionalInfo,
      );

      final response = await _apiService.post(
        '/insurance/api/v1/insurance/policies/apply',
        data: application.toJson(),
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return InsurancePolicy.fromJson(data['data']);
        }
        return InsurancePolicy.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Record premium payment for a policy
  Future<Map<String, dynamic>> recordPremiumPayment({
    required String policyId,
    required double amount,
    required String paymentMethod,
    String? transactionReference,
    Map<String, dynamic>? paymentDetails,
  }) async {
    try {
      final response = await _apiService.post(
        '/system/insurance/premiums/record-payment/$policyId',
        data: {
          'amount': amount,
          'payment_method': paymentMethod,
          if (transactionReference != null) 'transaction_reference': transactionReference,
          if (paymentDetails != null) 'payment_details': paymentDetails,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return Map<String, dynamic>.from(data['data']);
        }
        return Map<String, dynamic>.from(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get a specific insurance policy by ID
  Future<InsurancePolicy> getPolicyById(String policyId) async {
    try {
      final response = await _apiService.get('/insurance/api/v1/insurance/policies/$policyId');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return InsurancePolicy.fromJson(data['data']);
        }
        return InsurancePolicy.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get all insurance policies for the current customer
  Future<List<InsurancePolicy>> getCustomerPolicies() async {
    try {
      final response = await _apiService.get('/insurance/api/v1/insurance/policies/customer/all');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        // Handle API response structure: { "customer_id": "...", "policies": [...], "total": 1 }
        dynamic policiesData;
        
        if (data is Map && data.containsKey('policies')) {
          // Response has policies array wrapper
          policiesData = data['policies'];
        } else if (data is List) {
          policiesData = data;
        } else if (data is Map && data.containsKey('data')) {
          final innerData = data['data'];
          if (innerData is Map && innerData.containsKey('policies')) {
            policiesData = innerData['policies'];
          } else {
            policiesData = innerData;
          }
        } else {
          policiesData = data;
        }
        
        if (policiesData is String || policiesData == null) {
          return [];
        }
        
        if (policiesData is! List) {
          if (policiesData is Map) {
            policiesData = [policiesData];
          } else {
            return [];
          }
        }
        
        return policiesData.map((json) {
          if (json is Map<String, dynamic>) {
            return InsurancePolicy.fromJson(json);
          } else if (json is Map) {
            return InsurancePolicy.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid policy data format');
          }
        }).toList();
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Helper method to get formatted policy type display name
  String getPolicyTypeDisplayName(String policyType) {
    switch (policyType.toLowerCase()) {
      case 'health':
        return 'Health Insurance';
      case 'life':
        return 'Life Insurance';
      case 'auto':
        return 'Auto Insurance';
      case 'travel':
        return 'Travel Insurance';
      default:
        return policyType;
    }
  }

  // Helper method to get policy icon
  String getPolicyIcon(String policyType) {
    switch (policyType.toLowerCase()) {
      case 'health':
        return '🏥';
      case 'life':
        return '❤️';
      case 'auto':
        return '🚗';
      case 'travel':
        return '✈️';
      default:
        return '📋';
    }
  }

  // Get claims by policy ID
  Future<List<InsuranceClaim>> getClaimsByPolicyId(String policyId) async {
    try {
      final response = await _apiService.get('/insurance/api/v1/insurance/claims/policy/$policyId');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic claimsData;
        
        if (data is List) {
          claimsData = data;
        } else if (data is Map && data.containsKey('claims')) {
          claimsData = data['claims'];
        } else if (data is Map && data.containsKey('data')) {
          claimsData = data['data'];
        } else {
          claimsData = data;
        }
        
        if (claimsData is String || claimsData == null) {
          return [];
        }
        
        if (claimsData is! List) {
          if (claimsData is Map) {
            claimsData = [claimsData];
          } else {
            return [];
          }
        }
        
        return claimsData.map((json) {
          if (json is Map<String, dynamic>) {
            return InsuranceClaim.fromJson(json);
          } else if (json is Map) {
            return InsuranceClaim.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid claim data format');
          }
        }).toList();
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get all claims for the current customer
  Future<List<InsuranceClaim>> getAllClaims() async {
    try {
      final response = await _apiService.get('/insurance/api/v1/insurance/claims/customer/all');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic claimsData;
        
        if (data is List) {
          claimsData = data;
        } else if (data is Map && data.containsKey('claims')) {
          claimsData = data['claims'];
        } else if (data is Map && data.containsKey('data')) {
          claimsData = data['data'];
        } else {
          claimsData = data;
        }
        
        if (claimsData is String || claimsData == null) {
          return [];
        }
        
        if (claimsData is! List) {
          if (claimsData is Map) {
            claimsData = [claimsData];
          } else {
            return [];
          }
        }
        
        return claimsData.map((json) {
          if (json is Map<String, dynamic>) {
            return InsuranceClaim.fromJson(json);
          } else if (json is Map) {
            return InsuranceClaim.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid claim data format');
          }
        }).toList();
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Submit a new insurance claim
  Future<InsuranceClaim> submitClaim({
    required String policyId,
    required double claimAmount,
    required DateTime incidentDate,
    required String incidentDescription,
    List<String> supportingDocuments = const [],
  }) async {
    try {
      final response = await _apiService.post(
        '/insurance/api/v1/insurance/claims/submit',
        data: {
          'policy_id': policyId,
          'claim_amount': claimAmount,
          'incident_date': incidentDate.toIso8601String(),
          'incident_description': incidentDescription,
          'supporting_documents': supportingDocuments,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return InsuranceClaim.fromJson(data['data']);
        }
        return InsuranceClaim.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get claim by ID
  Future<InsuranceClaim> getClaimById(String claimId) async {
    try {
      final response = await _apiService.get('/api/v1/insurance/claims/$claimId');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return InsuranceClaim.fromJson(data['data']);
        }
        return InsuranceClaim.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get premium payment history
  Future<List<InsurancePremiumPayment>> getPremiumPayments() async {
    try {
      final response = await _apiService.get('/insurance/api/v1/insurance/premium-payments');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic paymentsData;
        
        if (data is List) {
          paymentsData = data;
        } else if (data is Map && data.containsKey('payments')) {
          paymentsData = data['payments'];
        } else if (data is Map && data.containsKey('data')) {
          paymentsData = data['data'];
        } else {
          paymentsData = data;
        }
        
        if (paymentsData is String || paymentsData == null) {
          return [];
        }
        
        if (paymentsData is! List) {
          if (paymentsData is Map) {
            paymentsData = [paymentsData];
          } else {
            return [];
          }
        }
        
        return paymentsData.map((json) {
          if (json is Map<String, dynamic>) {
            return InsurancePremiumPayment.fromJson(json);
          } else if (json is Map) {
            return InsurancePremiumPayment.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid payment data format');
          }
        }).toList();
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Make premium payment
  Future<InsurancePremiumPayment> makePremiumPayment({
    required String policyId,
    required double amount,
    required String paymentMethod,
  }) async {
    try {
      final response = await _apiService.post(
        '/insurance/api/v1/insurance/premium-payments',
        data: {
          'policy_id': policyId,
          'amount': amount,
          'payment_method': paymentMethod,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return InsurancePremiumPayment.fromJson(data['data']);
        }
        return InsurancePremiumPayment.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }
}
