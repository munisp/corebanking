import '../models/islamic_banking_product.dart';
import 'api_service.dart';
import '../config/app_config.dart';

class IslamicBankingService {
  final ApiService _apiService;

  IslamicBankingService(this._apiService);

  // ============================================================
  // MURABAHA - Cost-Plus Financing
  // ============================================================

  /// Get all Murabaha products for the current user
  Future<List<MurabahaProduct>> getAllMurabaha() async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/murabaha');
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic murabahaData;
        if (data is List) {
          murabahaData = data;
        } else if (data is Map && data.containsKey('data')) {
          murabahaData = data['data'];
        } else {
          murabahaData = data;
        }
        // Handle null data (empty endpoint)
        murabahaData ??= <dynamic>[];
        if (murabahaData is! List) {
          if (murabahaData is Map) {
            murabahaData = [murabahaData];
          } else {
            throw Exception('Invalid data format: expected array or object');
          }
        }
        return murabahaData.map((json) {
          if (json is Map<String, dynamic>) {
            return MurabahaProduct.fromJson(json);
          } else if (json is Map) {
            return MurabahaProduct.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid Murabaha data format');
          }
        }).toList();
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Murabaha products');
      }
    } catch (e) {
      throw Exception('Failed to fetch Murabaha products: $e');
    }
  }

  /// Get a specific Murabaha product by ID
  Future<MurabahaProduct> getMurabahaById(String id) async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/murabaha/$id');
      
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic murabahaData;
        
        if (data is Map && data.containsKey('data')) {
          murabahaData = data['data'];
        } else {
          murabahaData = data;
        }
        
        if (murabahaData is Map<String, dynamic>) {
          return MurabahaProduct.fromJson(murabahaData);
        } else if (murabahaData is Map) {
          return MurabahaProduct.fromJson(Map<String, dynamic>.from(murabahaData));
        } else {
          throw Exception('Invalid Murabaha data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Murabaha product');
      }
    } catch (e) {
      throw Exception('Failed to fetch Murabaha product: $e');
    }
  }

  /// Apply for a new Murabaha product
  Future<MurabahaProduct> applyForMurabaha({
    required String assetName,
    required double costPrice,
    required double profitMargin,
    required int tenureMonths,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.islamicBankingEndpoint}/murabaha',
        data: {
          'asset_name': assetName,
          'cost_price': costPrice,
          'profit_margin': profitMargin,
          'tenure_months': tenureMonths,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        dynamic murabahaData;
        
        if (data is Map && data.containsKey('data')) {
          murabahaData = data['data'];
        } else {
          murabahaData = data;
        }
        
        if (murabahaData is Map<String, dynamic>) {
          return MurabahaProduct.fromJson(murabahaData);
        } else if (murabahaData is Map) {
          return MurabahaProduct.fromJson(Map<String, dynamic>.from(murabahaData));
        } else {
          throw Exception('Invalid Murabaha data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to apply for Murabaha');
      }
    } catch (e) {
      throw Exception('Failed to apply for Murabaha: $e');
    }
  }

  // ============================================================
  // MUSHARAKA - Partnership Financing
  // ============================================================

  /// Get all Musharaka products for the current user
  /// MusharakaProduct
  /// musharakaData
  Future<List<MusharakaProduct>> getAllMusharaka() async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/musharaka');
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic musharakaData;
        if (data is List) {
          musharakaData = data;
        } else if (data is Map && data.containsKey('data')) {
          musharakaData = data['data'];
        } else {
          musharakaData = data;
        }
        // Handle null data (empty endpoint)
        musharakaData ??= <dynamic>[];
        if (musharakaData is! List) {
          if (musharakaData is Map) {
            musharakaData = [musharakaData];
          } else {
            throw Exception('Invalid data format: expected array or object');
          }
        }
        return musharakaData.map((json) {
          if (json is Map<String, dynamic>) {
            return MusharakaProduct.fromJson(json);
          } else if (json is Map) {
            return MusharakaProduct.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid Musharaka data format');
          }
        }).toList();
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Musharaka products');
      }
    } catch (e) {
      throw Exception('Failed to fetch Musharaka products: $e');
    }
  }

  /// Get a specific Musharaka product by ID
  /// getMusharakaById
  Future<MusharakaProduct> getMusharakaById(String id) async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/musharaka/$id');
      
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic musharakaData;
        
        if (data is Map && data.containsKey('data')) {
          musharakaData = data['data'];
        } else {
          musharakaData = data;
        }
        
        if (musharakaData is Map<String, dynamic>) {
          return MusharakaProduct.fromJson(musharakaData);
        } else if (musharakaData is Map) {
          return MusharakaProduct.fromJson(Map<String, dynamic>.from(musharakaData));
        } else {
          throw Exception('Invalid Musharaka data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Musharaka product');
      }
    } catch (e) {
      throw Exception('Failed to fetch Musharaka product: $e');
    }
  }

  /// Apply for a new Musharaka partnership
  Future<MusharakaProduct> applyForMusharaka({
    required String businessName,
    required double customerContribution,
    required double bankContribution,
    required double customerProfitShare,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.islamicBankingEndpoint}/musharaka',
        data: {
          'business_name': businessName,
          'customer_contribution': customerContribution,
          'bank_contribution': bankContribution,
          'customer_profit_share': customerProfitShare,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        dynamic musharakaData;
        
        if (data is Map && data.containsKey('data')) {
          musharakaData = data['data'];
        } else {
          musharakaData = data;
        }
        
        if (musharakaData is Map<String, dynamic>) {
          return MusharakaProduct.fromJson(musharakaData);
        } else if (musharakaData is Map) {
          return MusharakaProduct.fromJson(Map<String, dynamic>.from(musharakaData));
        } else {
          throw Exception('Invalid Musharaka data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to apply for Musharaka');
      }
    } catch (e) {
      throw Exception('Failed to apply for Musharaka: $e');
    }
  }

  // ============================================================
  // IJARA - Leasing
  // ============================================================

  /// Get all Ijara products for the current user
  Future<List<IjaraProduct>> getAllIjara() async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/ijara');
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic ijaraData;
        if (data is List) {
          ijaraData = data;
        } else if (data is Map && data.containsKey('data')) {
          ijaraData = data['data'];
        } else {
          ijaraData = data;
        }
        // Handle null data (empty endpoint)
        ijaraData ??= <dynamic>[];
        if (ijaraData is! List) {
          if (ijaraData is Map) {
            ijaraData = [ijaraData];
          } else {
            throw Exception('Invalid data format: expected array or object');
          }
        }
        return ijaraData.map((json) {
          if (json is Map<String, dynamic>) {
            return IjaraProduct.fromJson(json);
          } else if (json is Map) {
            return IjaraProduct.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid Ijara data format');
          }
        }).toList();
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Ijara products');
      }
    } catch (e) {
      throw Exception('Failed to fetch Ijara products: $e');
    }
  }

  /// Get a specific Ijara product by ID
  Future<IjaraProduct> getIjaraById(String id) async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/ijara/$id');
      
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic ijaraData;
        
        if (data is Map && data.containsKey('data')) {
          ijaraData = data['data'];
        } else {
          ijaraData = data;
        }
        
        if (ijaraData is Map<String, dynamic>) {
          return IjaraProduct.fromJson(ijaraData);
        } else if (ijaraData is Map) {
          return IjaraProduct.fromJson(Map<String, dynamic>.from(ijaraData));
        } else {
          throw Exception('Invalid Ijara data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Ijara product');
      }
    } catch (e) {
      throw Exception('Failed to fetch Ijara product: $e');
    }
  }

  /// Apply for a new Ijara lease
  Future<IjaraProduct> applyForIjara({
    required String assetName,
    required double assetValue,
    required int tenureMonths,
    required String leaseType,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.islamicBankingEndpoint}/ijara',
        data: {
          'asset_name': assetName,
          'asset_value': assetValue,
          'tenure_months': tenureMonths,
          'lease_type': leaseType,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        dynamic ijaraData;
        
        if (data is Map && data.containsKey('data')) {
          ijaraData = data['data'];
        } else {
          ijaraData = data;
        }
        
        if (ijaraData is Map<String, dynamic>) {
          return IjaraProduct.fromJson(ijaraData);
        } else if (ijaraData is Map) {
          return IjaraProduct.fromJson(Map<String, dynamic>.from(ijaraData));
        } else {
          throw Exception('Invalid Ijara data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to apply for Ijara');
      }
    } catch (e) {
      throw Exception('Failed to apply for Ijara: $e');
    }
  }

  // ============================================================
  // TAKAFUL - Islamic Insurance
  // ============================================================

  /// Get all Takaful products for the current user
  Future<List<TakafulProduct>> getAllTakaful() async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/takaful');
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic takafulData;
        if (data is List) {
          takafulData = data;
        } else if (data is Map && data.containsKey('data')) {
          takafulData = data['data'];
        } else {
          takafulData = data;
        }
        // Handle null data (empty endpoint)
        takafulData ??= <dynamic>[];
        if (takafulData is! List) {
          if (takafulData is Map) {
            takafulData = [takafulData];
          } else {
            throw Exception('Invalid data format: expected array or object');
          }
        }
        return takafulData.map((json) {
          if (json is Map<String, dynamic>) {
            return TakafulProduct.fromJson(json);
          } else if (json is Map) {
            return TakafulProduct.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid Takaful data format');
          }
        }).toList();
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Takaful products');
      }
    } catch (e) {
      throw Exception('Failed to fetch Takaful products: $e');
    }
  }

  /// Get a specific Takaful product by ID
  Future<TakafulProduct> getTakafulById(String id) async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/takaful/$id');
      
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic takafulData;
        
        if (data is Map && data.containsKey('data')) {
          takafulData = data['data'];
        } else {
          takafulData = data;
        }
        
        if (takafulData is Map<String, dynamic>) {
          return TakafulProduct.fromJson(takafulData);
        } else if (takafulData is Map) {
          return TakafulProduct.fromJson(Map<String, dynamic>.from(takafulData));
        } else {
          throw Exception('Invalid Takaful data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Takaful product');
      }
    } catch (e) {
      throw Exception('Failed to fetch Takaful product: $e');
    }
  }

  /// Apply for a new Takaful policy
  Future<TakafulProduct> applyForTakaful({
    required String policyType,
    required String policyName,
    required double coverageAmount,
    required String frequency,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.islamicBankingEndpoint}/takaful',
        data: {
          'policy_type': policyType,
          'policy_name': policyName,
          'coverage_amount': coverageAmount,
          'frequency': frequency,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        dynamic takafulData;
        
        if (data is Map && data.containsKey('data')) {
          takafulData = data['data'];
        } else {
          takafulData = data;
        }
        
        if (takafulData is Map<String, dynamic>) {
          return TakafulProduct.fromJson(takafulData);
        } else if (takafulData is Map) {
          return TakafulProduct.fromJson(Map<String, dynamic>.from(takafulData));
        } else {
          throw Exception('Invalid Takaful data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to apply for Takaful');
      }
    } catch (e) {
      throw Exception('Failed to apply for Takaful: $e');
    }
  }

  // ============================================================
  // SUKUK - Islamic Bonds
  // ============================================================

  /// Get all Sukuk products for the current user
  Future<List<SukukProduct>> getAllSukuk() async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/sukuk');
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic sukukData;
        if (data is List) {
          sukukData = data;
        } else if (data is Map && data.containsKey('data')) {
          sukukData = data['data'];
        } else {
          sukukData = data;
        }
        // Handle null data (empty endpoint)
        sukukData ??= <dynamic>[];
        if (sukukData is! List) {
          if (sukukData is Map) {
            sukukData = [sukukData];
          } else {
            throw Exception('Invalid data format: expected array or object');
          }
        }
        return sukukData.map((json) {
          if (json is Map<String, dynamic>) {
            return SukukProduct.fromJson(json);
          } else if (json is Map) {
            return SukukProduct.fromJson(Map<String, dynamic>.from(json));
          } else {
            throw Exception('Invalid Sukuk data format');
          }
        }).toList();
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Sukuk products');
      }
    } catch (e) {
      throw Exception('Failed to fetch Sukuk products: $e');
    }
  }

  /// Get a specific Sukuk product by ID
  Future<SukukProduct> getSukukById(String id) async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/sukuk/$id');
      
      if (response.statusCode == 200) {
        final data = response.data;
        dynamic sukukData;
        
        if (data is Map && data.containsKey('data')) {
          sukukData = data['data'];
        } else {
          sukukData = data;
        }
        
        if (sukukData is Map<String, dynamic>) {
          return SukukProduct.fromJson(sukukData);
        } else if (sukukData is Map) {
          return SukukProduct.fromJson(Map<String, dynamic>.from(sukukData));
        } else {
          throw Exception('Invalid Sukuk data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch Sukuk product');
      }
    } catch (e) {
      throw Exception('Failed to fetch Sukuk product: $e');
    }
  }

  /// Invest in a new Sukuk product
  Future<SukukProduct> investInSukuk({
    required String sukukType,
    required String sukukName,
    required double investmentAmount,
    required int tenureMonths,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.islamicBankingEndpoint}/sukuk',
        data: {
          'sukuk_type': sukukType,
          'sukuk_name': sukukName,
          'investment_amount': investmentAmount,
          'tenure_months': tenureMonths,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        dynamic sukukData;
        
        if (data is Map && data.containsKey('data')) {
          sukukData = data['data'];
        } else {
          sukukData = data;
        }
        
        if (sukukData is Map<String, dynamic>) {
          return SukukProduct.fromJson(sukukData);
        } else if (sukukData is Map) {
          return SukukProduct.fromJson(Map<String, dynamic>.from(sukukData));
        } else {
          throw Exception('Invalid Sukuk data format');
        }
      } else {
        throw Exception(response.data['message'] ?? 'Failed to invest in Sukuk');
      }
    } catch (e) {
      throw Exception('Failed to invest in Sukuk: $e');
    }
  }

  // ============================================================
  // COMMON OPERATIONS
  // ============================================================

  /// Get all Islamic banking products for the current user (aggregated)
  Future<Map<String, dynamic>> getAllProducts() async {
    try {
      final response = await _apiService.get('${AppConfig.islamicBankingEndpoint}/products');
      
      if (response.statusCode == 200) {
        final data = response.data;
        return {
          'murabaha': data['murabaha'] ?? [],
          'musharaka': data['musharaka'] ?? [],
          'ijara': data['ijara'] ?? [],
          'takaful': data['takaful'] ?? [],
          'sukuk': data['sukuk'] ?? [],
        };
      } else {
        throw Exception(response.data['message'] ?? 'Failed to fetch all products');
      }
    } catch (e) {
      throw Exception('Failed to fetch all products: $e');
    }
  }

  /// Cancel a product application
  Future<bool> cancelProduct(String productType, String productId) async {
    try {
      final response = await _apiService.delete(
        '${AppConfig.islamicBankingEndpoint}/$productType/$productId',
      );
      
      if (response.statusCode == 200 || response.statusCode == 204) {
        return true;
      } else {
        throw Exception(response.data['message'] ?? 'Failed to cancel product');
      }
    } catch (e) {
      throw Exception('Failed to cancel product: $e');
    }
  }

  /// Update product status
  Future<bool> updateProductStatus(String productType, String productId, String status) async {
    try {
      final response = await _apiService.put(
        '${AppConfig.islamicBankingEndpoint}/$productType/$productId/status',
        data: {
          'status': status,
        },
      );
      
      if (response.statusCode == 200) {
        return true;
      } else {
        throw Exception(response.data['message'] ?? 'Failed to update product status');
      }
    } catch (e) {
      throw Exception('Failed to update product status: $e');
    }
  }
}
