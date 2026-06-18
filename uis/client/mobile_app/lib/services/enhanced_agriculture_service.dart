import 'package:flutter/foundation.dart';
import '../models/agriculture_models.dart';
import 'enhanced_api_service.dart';
import '../config/app_config.dart';
import '../utils/error_handler.dart';

class AgricultureService {
  AgricultureService._();
  static final AgricultureService instance = AgricultureService._();

  final EnhancedApiService _api = EnhancedApiService.instance;
  late String _baseUrl;

  void initialize({String? baseUrl}) {
    _baseUrl = baseUrl ?? AppConfig.agricultureEndpoint;
  }

  void _log(String endpoint, dynamic data, {bool isError = false}) {
    if (kDebugMode) {
      final prefix = isError ? '❌' : '✅';
      print('$prefix AGRICULTURE [$endpoint]: $data');
    }
  }

  // ================= FARMER PROFILE =================

  /// Register a new farmer
  Future<ApiResponse<FarmerProfile>> registerFarmer({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required FarmerType farmerType,
    required String farmLocation,
    required double farmSize,
    required List<String> primaryCrops,
    List<String>? secondaryCrops,
    String? yearsOfExperience,
    double? latitude,
    double? longitude,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final data = {
        'first_name': firstName,
        'last_name': lastName,
        'email': email,
        'phone': phone,
        'farmer_type': farmerType.name,
        'farm_location': farmLocation,
        'farm_size': farmSize,
        'primary_crops': primaryCrops,
        'secondary_crops': secondaryCrops ?? [],
        'years_of_experience': yearsOfExperience,
        'latitude': latitude,
        'longitude': longitude,
        'metadata': metadata,
      };

      final response = await _api.post<Map<String, dynamic>>(
        '$_baseUrl/farmers',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/farmers (create)', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final farmer = FarmerProfile.fromJson(data);
          _log('/farmers (create)', farmer.id);
          return ApiResponse.success(farmer);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farmers (create)', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Get farmer profile by ID
  Future<ApiResponse<FarmerProfile>> getFarmerProfile(String farmerId) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '$_baseUrl/farmers/$farmerId',
        cacheExpiry: const Duration(hours: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/farmers/$farmerId', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final farmer = FarmerProfile.fromJson(data);
          _log('/farmers/$farmerId', farmer.id);
          return ApiResponse.success(farmer, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farmers/$farmerId', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Update farmer profile
  Future<ApiResponse<FarmerProfile>> updateFarmerProfile(
    String farmerId, {
    String? firstName,
    String? lastName,
    String? phone,
    String? farmLocation,
    double? farmSize,
    List<String>? primaryCrops,
    List<String>? secondaryCrops,
    double? latitude,
    double? longitude,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (firstName != null) data['first_name'] = firstName;
      if (lastName != null) data['last_name'] = lastName;
      if (phone != null) data['phone'] = phone;
      if (farmLocation != null) data['farm_location'] = farmLocation;
      if (farmSize != null) data['farm_size'] = farmSize;
      if (primaryCrops != null) data['primary_crops'] = primaryCrops;
      if (secondaryCrops != null) data['secondary_crops'] = secondaryCrops;
      if (latitude != null) data['latitude'] = latitude;
      if (longitude != null) data['longitude'] = longitude;

      final response = await _api.put<Map<String, dynamic>>(
        '$_baseUrl/farmers/$farmerId',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/farmers/$farmerId (update)', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final farmer = FarmerProfile.fromJson(data);
          _log('/farmers/$farmerId (update)', farmer.id);
          _api.clearCache('$_baseUrl/farmers/$farmerId');
          return ApiResponse.success(farmer);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farmers/$farmerId (update)', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  // ================= FARMS =================

  /// Get farmer's farms
  Future<ApiResponse<List<Farm>>> getFarmerFarms(String farmerId) async {
    try {
      final response = await _api.get<List<dynamic>>(
        '$_baseUrl/farmers/$farmerId/farms',
        cacheExpiry: const Duration(hours: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/farmers/$farmerId/farms', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final farms = data.map((f) => Farm.fromJson(f)).toList();
          _log('/farmers/$farmerId/farms', '${farms.length} farms');
          return ApiResponse.success(farms, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farmers/$farmerId/farms', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Register a new farm
  Future<ApiResponse<Farm>> registerFarm({
    required String farmerId,
    required String name,
    required String location,
    required double latitude,
    required double longitude,
    required double sizeHectares,
    required String soilType,
    required String climate,
    required List<String> crops,
  }) async {
    try {
      final data = {
        'farmer_id': farmerId,
        'name': name,
        'location': location,
        'latitude': latitude,
        'longitude': longitude,
        'size_hectares': sizeHectares,
        'soil_type': soilType,
        'climate': climate,
        'crops': crops,
      };

      final response = await _api.post<Map<String, dynamic>>(
        '$_baseUrl/farms',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/farms (create)', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final farm = Farm.fromJson(data);
          _log('/farms (create)', farm.id);
          _api.clearCache('$_baseUrl/farmers/$farmerId/farms');
          return ApiResponse.success(farm);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farms (create)', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Verify farm
  Future<ApiResponse<Farm>> verifyFarm(
    String farmId, {
    required double latitude,
    required double longitude,
    String? documentUrl,
  }) async {
    try {
      final data = {
        'latitude': latitude,
        'longitude': longitude,
        if (documentUrl != null) 'document_url': documentUrl,
      };

      final response = await _api.post<Map<String, dynamic>>(
        '$_baseUrl/farms/$farmId/verify',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/farms/$farmId/verify', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final farm = Farm.fromJson(data);
          _log('/farms/$farmId/verify', farm.status.name);
          return ApiResponse.success(farm);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farms/$farmId/verify', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  // ================= CROPS =================

  /// List all available crops
  Future<ApiResponse<List<CropMarketData>>> listCrops() async {
    try {
      final response = await _api.get<List<dynamic>>(
        '$_baseUrl/crops',
        cacheExpiry: const Duration(days: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/crops', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final crops = data.map((c) => CropMarketData.fromJson(c)).toList();
          _log('/crops', '${crops.length} crops');
          return ApiResponse.success(crops, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/crops', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Get crop details
  Future<ApiResponse<CropMarketData>> getCropDetails(String cropType) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '$_baseUrl/crops/$cropType',
        cacheExpiry: const Duration(days: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/crops/$cropType', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final crop = CropMarketData.fromJson(data);
          _log('/crops/$cropType', crop.cropType);
          return ApiResponse.success(crop, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/crops/$cropType', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  // ================= AGRICULTURAL LOANS =================

  /// List available loan products
  Future<ApiResponse<List<AgriculturalLoan>>> listLoans() async {
    try {
      final response = await _api.get<List<dynamic>>(
        '$_baseUrl/loans',
        cacheExpiry: const Duration(hours: 2),
      );

      return response.fold(
        (error, statusCode) {
          _log('/loans', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final loans = data.map((l) => AgriculturalLoan.fromJson(l)).toList();
          _log('/loans', '${loans.length} loans');
          return ApiResponse.success(loans, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/loans', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Apply for a loan
  Future<ApiResponse<AgriculturalLoan>> applyForLoan({
    required String farmerId,
    required String? farmId,
    required double amount,
    required int tenorMonths,
    required String purpose,
    String? collateral,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final data = {
        'farmer_id': farmerId,
        'farm_id': farmId,
        'amount': amount,
        'tenor_months': tenorMonths,
        'purpose': purpose,
        'collateral': collateral,
        'metadata': metadata,
      };

      final response = await _api.post<Map<String, dynamic>>(
        '$_baseUrl/loans/apply',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/loans/apply', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final loan = AgriculturalLoan.fromJson(data);
          _log('/loans/apply', loan.id);
          return ApiResponse.success(loan);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/loans/apply', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Get loan details
  Future<ApiResponse<AgriculturalLoan>> getLoanDetails(String loanId) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '$_baseUrl/loans/$loanId',
        cacheExpiry: const Duration(hours: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/loans/$loanId', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final loan = AgriculturalLoan.fromJson(data);
          _log('/loans/$loanId', loan.status.name);
          return ApiResponse.success(loan, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/loans/$loanId', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Get farmer's loans
  Future<ApiResponse<List<AgriculturalLoan>>> getFarmerLoans(String farmerId) async {
    try {
      final response = await _api.get<List<dynamic>>(
        '$_baseUrl/farmers/$farmerId/loans',
        cacheExpiry: const Duration(hours: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/farmers/$farmerId/loans', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final loans = data.map((l) => AgriculturalLoan.fromJson(l)).toList();
          _log('/farmers/$farmerId/loans', '${loans.length} loans');
          return ApiResponse.success(loans, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farmers/$farmerId/loans', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  // ================= TRANSACTIONS =================

  /// Get transaction history
  Future<ApiResponse<List<Transaction>>> getTransactionHistory(
    String farmerId, {
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final response = await _api.get<List<dynamic>>(
        '$_baseUrl/farmers/$farmerId/transactions',
        queryParameters: {'limit': limit, 'offset': offset},
        cacheExpiry: const Duration(minutes: 5),
      );

      return response.fold(
        (error, statusCode) {
          _log('/farmers/$farmerId/transactions', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final transactions = data.map((t) => Transaction.fromJson(t)).toList();
          _log('/farmers/$farmerId/transactions', '${transactions.length} transactions');
          return ApiResponse.success(transactions, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farmers/$farmerId/transactions', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Get transaction details
  Future<ApiResponse<Transaction>> getTransactionDetails(String transactionId) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '$_baseUrl/transactions/$transactionId',
        cacheExpiry: const Duration(hours: 24),
      );

      return response.fold(
        (error, statusCode) {
          _log('/transactions/$transactionId', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final transaction = Transaction.fromJson(data);
          _log('/transactions/$transactionId', transaction.id);
          return ApiResponse.success(transaction, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/transactions/$transactionId', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  // ================= COOPERATIVES =================

  /// Get farmer's cooperatives
  Future<ApiResponse<List<CooperativeSavings>>> getFarmerCooperatives(
    String farmerId,
  ) async {
    try {
      final response = await _api.get<List<dynamic>>(
        '$_baseUrl/farmers/$farmerId/cooperatives',
        cacheExpiry: const Duration(hours: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/farmers/$farmerId/cooperatives', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final coops = data.map((c) => CooperativeSavings.fromJson(c)).toList();
          _log('/farmers/$farmerId/cooperatives', '${coops.length} cooperatives');
          return ApiResponse.success(coops, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/farmers/$farmerId/cooperatives', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Join a cooperative
  Future<ApiResponse<CooperativeSavings>> joinCooperative({
    required String farmerId,
    required String cooperativeId,
  }) async {
    try {
      final data = {
        'farmer_id': farmerId,
        'cooperative_id': cooperativeId,
      };

      final response = await _api.post<Map<String, dynamic>>(
        '$_baseUrl/cooperatives/$cooperativeId/join',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/cooperatives/$cooperativeId/join', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final coop = CooperativeSavings.fromJson(data);
          _log('/cooperatives/$cooperativeId/join', coop.id);
          return ApiResponse.success(coop);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/cooperatives/$cooperativeId/join', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Make cooperative contribution
  Future<ApiResponse<Transaction>> contributeToCooperative({
    required String cooperativeId,
    required String farmerId,
    required double amount,
  }) async {
    try {
      final data = {
        'cooperative_id': cooperativeId,
        'farmer_id': farmerId,
        'amount': amount,
      };

      final response = await _api.post<Map<String, dynamic>>(
        '$_baseUrl/cooperatives/$cooperativeId/contribute',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/cooperatives/$cooperativeId/contribute', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final transaction = Transaction.fromJson(data);
          _log('/cooperatives/$cooperativeId/contribute', transaction.id);
          return ApiResponse.success(transaction);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/cooperatives/$cooperativeId/contribute', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  // ================= MARKETPLACE =================

  /// List marketplace listings
  Future<ApiResponse<List<MarketplaceListing>>> listMarketplaceListings({
    String? cropType,
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final response = await _api.get<List<dynamic>>(
        '$_baseUrl/marketplace/listings',
        queryParameters: {
          'crop_type': cropType,
          'limit': limit,
          'offset': offset,
        },
        cacheExpiry: const Duration(hours: 1),
      );

      return response.fold(
        (error, statusCode) {
          _log('/marketplace/listings', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final listings = data.map((l) => MarketplaceListing.fromJson(l)).toList();
          _log('/marketplace/listings', '${listings.length} listings');
          return ApiResponse.success(listings, isFromCache: isFromCache);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/marketplace/listings', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Create marketplace listing
  Future<ApiResponse<MarketplaceListing>> createMarketplaceListing({
    required String farmerId,
    required String cropType,
    required double quantityTonnes,
    required double pricePerTonne,
    required String location,
    String? imageUrl,
  }) async {
    try {
      final data = {
        'farmer_id': farmerId,
        'crop_type': cropType,
        'quantity_tonnes': quantityTonnes,
        'price_per_tonne': pricePerTonne,
        'location': location,
        'image_url': imageUrl,
      };

      final response = await _api.post<Map<String, dynamic>>(
        '$_baseUrl/marketplace/listings',
        data: data,
      );

      return response.fold(
        (error, statusCode) {
          _log('/marketplace/listings (create)', error, isError: true);
          return ApiResponse.error(error, statusCode: statusCode);
        },
        (data, isFromCache) {
          final listing = MarketplaceListing.fromJson(data);
          _log('/marketplace/listings (create)', listing.id);
          _api.clearCache('$_baseUrl/marketplace/listings');
          return ApiResponse.success(listing);
        },
      );
    } catch (e) {
      final exception = ErrorHandler.handle(e);
      _log('/marketplace/listings (create)', exception.message, isError: true);
      return ApiResponse.error(exception.displayMessage);
    }
  }

  /// Clear cache
  void clearCache() {
    _api.clearCache();
  }
}

/// Singleton provider
final agricultureService = AgricultureService.instance;
