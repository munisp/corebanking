import '../models/carbon_footprint.dart';
import '../models/carbon_credit.dart';
import '../models/carbon_project.dart';
import '../models/carbon_trade.dart';
import 'api_service.dart';
import 'error_handler_service.dart';

class CarbonService {
  final ApiService _apiService = ApiService();

  // Get all carbon footprints for the current user
  Future<List<CarbonFootprint>> getFootprints() async {
    try {
      final response = await _apiService.get('/carbon/api/v1/carbon/footprints');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        // Handle different response structures
        dynamic footprintsData;
        
        if (data is List) {
          footprintsData = data;
        } else if (data is Map && data.containsKey('footprints')) {
          footprintsData = data['footprints'];
        } else if (data is Map && data.containsKey('data')) {
          footprintsData = data['data'];
        } else {
          footprintsData = data;
        }
        
        if (footprintsData is String || footprintsData == null) {
          return [];
        }
        
        if (footprintsData is! List) {
          if (footprintsData is Map) {
            footprintsData = [footprintsData];
          } else {
            return [];
          }
        }
        
        return footprintsData.map((json) {
          if (json is Map<String, dynamic>) {
            return CarbonFootprint.fromJson(json);
          } else if (json is Map) {
            return CarbonFootprint.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid footprint data format');
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

  // Get all carbon credits for the current user
  Future<List<CarbonCredit>> getCredits() async {
    try {
      final response = await _apiService.get('/carbon/api/v1/carbon/credits');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic creditsData;
        
        if (data is List) {
          creditsData = data;
        } else if (data is Map && data.containsKey('credits')) {
          creditsData = data['credits'];
        } else if (data is Map && data.containsKey('data')) {
          creditsData = data['data'];
        } else {
          creditsData = data;
        }
        
        if (creditsData is String || creditsData == null) {
          return [];
        }
        
        if (creditsData is! List) {
          if (creditsData is Map) {
            creditsData = [creditsData];
          } else {
            return [];
          }
        }
        
        return creditsData.map((json) {
          if (json is Map<String, dynamic>) {
            return CarbonCredit.fromJson(json);
          } else if (json is Map) {
            return CarbonCredit.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid credit data format');
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

  // Get a specific carbon credit by ID
  Future<CarbonCredit> getCreditById(String creditId) async {
    try {
      final response = await _apiService.get('/carbon/api/v1/carbon/credits/$creditId');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return CarbonCredit.fromJson(data['data']);
        }
        return CarbonCredit.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get all carbon projects
  Future<List<CarbonProject>> getProjects() async {
    try {
      final response = await _apiService.get('/carbon/api/v1/carbon/projects');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic projectsData;
        
        if (data is List) {
          projectsData = data;
        } else if (data is Map && data.containsKey('projects')) {
          projectsData = data['projects'];
        } else if (data is Map && data.containsKey('data')) {
          projectsData = data['data'];
        } else {
          projectsData = data;
        }
        
        if (projectsData is String || projectsData == null) {
          return [];
        }
        
        if (projectsData is! List) {
          if (projectsData is Map) {
            projectsData = [projectsData];
          } else {
            return [];
          }
        }
        
        return projectsData.map((json) {
          if (json is Map<String, dynamic>) {
            return CarbonProject.fromJson(json);
          } else if (json is Map) {
            return CarbonProject.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid project data format');
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

  // Get a specific carbon project by ID
  Future<CarbonProject> getProjectById(String projectId) async {
    try {
      final response = await _apiService.get('/carbon/api/v1/carbon/projects/$projectId');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return CarbonProject.fromJson(data['data']);
        }
        return CarbonProject.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Get all carbon trades for the current user
  Future<List<CarbonTrade>> getTrades() async {
    try {
      final response = await _apiService.get('/carbon/api/v1/carbon/trades');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        dynamic tradesData;
        
        if (data is List) {
          tradesData = data;
        } else if (data is Map && data.containsKey('trades')) {
          tradesData = data['trades'];
        } else if (data is Map && data.containsKey('data')) {
          tradesData = data['data'];
        } else {
          tradesData = data;
        }
        
        if (tradesData is String || tradesData == null) {
          return [];
        }
        
        if (tradesData is! List) {
          if (tradesData is Map) {
            tradesData = [tradesData];
          } else {
            return [];
          }
        }
        
        return tradesData.map((json) {
          if (json is Map<String, dynamic>) {
            return CarbonTrade.fromJson(json);
          } else if (json is Map) {
            return CarbonTrade.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid trade data format');
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

  // Get a specific carbon trade by ID
  Future<CarbonTrade> getTradeById(String tradeId) async {
    try {
      final response = await _apiService.get('/carbon/api/v1/carbon/trades/$tradeId');
      
      if (response.statusCode == 200) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return CarbonTrade.fromJson(data['data']);
        }
        return CarbonTrade.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Purchase carbon credits
  Future<CarbonTrade> purchaseCredits({
    required String projectId,
    required int quantity,
    required double pricePerCredit,
    String? creditId,
    String? sellerId,
    String? buyerId,
  }) async {
    try {
      final response = await _apiService.post(
        '/carbon/api/v1/carbon/trades',
        data: {
          'CreditID': creditId ?? projectId, // Use projectId as fallback
          'SellerID': sellerId ?? 'SYSTEM', // System seller for direct purchases
          'BuyerID': buyerId ?? '', // Will be filled by backend from auth
          'PricePerUnit': pricePerCredit,
          'Quantity': quantity,
          'TradeType': 'buy',
          'ProjectID': projectId,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return CarbonTrade.fromJson(data['data']);
        }
        return CarbonTrade.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Issue carbon credits
  Future<CarbonCredit> issueCredits({
    required String projectId,
    required int quantity,
    required String ownerId,
    required double pricePerUnit,
  }) async {
    try {
      final response = await _apiService.post(
        '/carbon/api/v1/carbon/credits/issue',
        data: {
          'project_id': projectId,
          'quantity': quantity,
          'owner_id': ownerId,
          'price_per_unit': pricePerUnit,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return CarbonCredit.fromJson(data['data']);
        }
        return CarbonCredit.fromJson(data);
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // Retire carbon credits
  Future<Map<String, dynamic>> retireCredits({
    required String creditId,
    required int quantity,
    required String retirementReason,
  }) async {
    try {
      final response = await _apiService.post(
        '/carbon/api/v1/carbon/credits/$creditId/retire',
        data: {
          'quantity': quantity,
          'retirement_reason': retirementReason,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        
        if (data is Map && data.containsKey('data')) {
          return data['data'] as Map<String, dynamic>;
        }
        return data as Map<String, dynamic>;
      } else {
        final errorMessage = ErrorHandlerService.handleError(response.data);
        throw Exception(errorMessage);
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }
}
