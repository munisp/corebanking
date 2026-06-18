import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/agriculture_models_extended.dart';
import 'enhanced_api_service.dart';

/// Extended Agriculture Service - Full 19-Feature Coverage
/// Includes all additional features beyond core MVP
/// Services: Partners, Risk, eVoucher, IoT, Logistics, Savings,
/// Reinsurance, Yield Prediction, Boundary Mapping, Satellite,
/// Soil Analysis, Livestock, Commodity Exchange, Warehouse,
/// CBN Returns, NIRSAL AgroCoop, Anchor Borrowers

class ExtendedAgriculturalService {
  static final ExtendedAgriculturalService _instance = ExtendedAgriculturalService._internal();

  factory ExtendedAgriculturalService() {
    return _instance;
  }

  ExtendedAgriculturalService._internal();

  final EnhancedApiService apiService = EnhancedApiService.instance;

  // ========== AGRI PARTNERS ==========

  Future<ApiResponse<List<AgriculturalPartner>>> listPartners({
    PartnershipType? type,
    String? location,
    int page = 1,
  }) async {
    final queryParams = {
      if (type != null) 'type': type.index,
      if (location != null) 'location': location,
      'page': page,
    };

    return apiService.get<List<AgriculturalPartner>>(
      '/partners',
      queryParameters: queryParams,
      parser: (data) => (data as List).map((p) => AgriculturalPartner.fromJson(p)).toList(),
    );
  }

  Future<ApiResponse<AgriculturalPartner>> getPartnerDetails(String partnerId) async {
    return apiService.get<AgriculturalPartner>(
      '/partners/$partnerId',
      parser: (data) => AgriculturalPartner.fromJson(data),
    );
  }

  Future<ApiResponse<AgriculturalPartner>> createPartner(
    AgriculturalPartner partner,
  ) async {
    return apiService.post<AgriculturalPartner>(
      '/partners',
      data: partner.toJson(),
      parser: (data) => AgriculturalPartner.fromJson(data),
    );
  }

  Future<ApiResponse<AgriculturalPartner>> updatePartner(
    String partnerId,
    AgriculturalPartner partner,
  ) async {
    return apiService.put<AgriculturalPartner>(
      '/partners/$partnerId',
      data: partner.toJson(),
      parser: (data) => AgriculturalPartner.fromJson(data),
    );
  }

  Future<ApiResponse<void>> deletePartner(String partnerId) async {
    return apiService.delete('/partners/$partnerId');
  }

  // ========== AGRI RISK ==========

  Future<ApiResponse<List<AgriculturalRisk>>> getFarmRisks(String farmId) async {
    return apiService.get<List<AgriculturalRisk>>(
      '/farms/$farmId/risks',
      parser: (data) => (data as List).map((r) => AgriculturalRisk.fromJson(r)).toList(),
    );
  }

  Future<ApiResponse<AgriculturalRisk>> createRiskAssessment(
    String farmId,
    AgriculturalRisk risk,
  ) async {
    return apiService.post<AgriculturalRisk>(
      '/farms/$farmId/risks',
      data: risk.toJson(),
      parser: (data) => AgriculturalRisk.fromJson(data),
    );
  }

  Future<ApiResponse<AgriculturalRisk>> updateRiskAssessment(
    String farmId,
    String riskId,
    AgriculturalRisk risk,
  ) async {
    return apiService.put<AgriculturalRisk>(
      '/farms/$farmId/risks/$riskId',
      data: risk.toJson(),
      parser: (data) => AgriculturalRisk.fromJson(data),
    );
  }

  Future<ApiResponse<void>> resolveRisk(String farmId, String riskId) async {
    return apiService.patch(
      '/farms/$farmId/risks/$riskId/resolve',
    );
  }

  // ========== AGRI E-VOUCHER ==========

  Future<ApiResponse<List<AgriculturalEVoucher>>> getFarmerVouchers(String farmerId) async {
    return apiService.get<List<AgriculturalEVoucher>>(
      '/farmers/$farmerId/vouchers',
      parser: (data) => (data as List).map((v) => AgriculturalEVoucher.fromJson(v)).toList(),
    );
  }

  Future<ApiResponse<AgriculturalEVoucher>> redeemVoucher(
    String voucherId,
    String partnerId,
  ) async {
    return apiService.post<AgriculturalEVoucher>(
      '/vouchers/$voucherId/redeem',
      data: {'partnerId': partnerId},
      parser: (data) => AgriculturalEVoucher.fromJson(data),
    );
  }

  Future<ApiResponse<AgriculturalEVoucher>> transferVoucher(
    String voucherId,
    String targetFarmerId,
  ) async {
    return apiService.post<AgriculturalEVoucher>(
      '/vouchers/$voucherId/transfer',
      data: {'targetFarmerId': targetFarmerId},
      parser: (data) => AgriculturalEVoucher.fromJson(data),
    );
  }

  // ========== IOT SENSORS ==========

  Future<ApiResponse<List<IoTSensor>>> getFarmSensors(String farmId) async {
    return apiService.get<List<IoTSensor>>(
      '/farms/$farmId/sensors',
      parser: (data) => (data as List).map((s) => IoTSensor.fromJson(s)).toList(),
    );
  }

  Future<ApiResponse<IoTSensor>> installSensor(
    String farmId,
    IoTSensor sensor,
  ) async {
    return apiService.post<IoTSensor>(
      '/farms/$farmId/sensors',
      data: sensor.toJson(),
      parser: (data) => IoTSensor.fromJson(data),
    );
  }

  Future<ApiResponse<List<SensorReading>>> getSensorReadings(
    String sensorId, {
    DateTime? from,
    DateTime? to,
    int? limit,
  }) async {
    final queryParams = {
      if (from != null) 'from': from.toIso8601String(),
      if (to != null) 'to': to.toIso8601String(),
      if (limit != null) 'limit': limit,
    };

    return apiService.get<List<SensorReading>>(
      '/sensors/$sensorId/readings',
      queryParameters: queryParams,
      parser: (data) => (data as List).map((r) => SensorReading.fromJson(r)).toList(),
    );
  }

  Future<ApiResponse<SensorReading>> getLatestReading(String sensorId) async {
    return apiService.get<SensorReading>(
      '/sensors/$sensorId/readings/latest',
      parser: (data) => SensorReading.fromJson(data),
    );
  }

  Future<ApiResponse<void>> deactivateSensor(String sensorId) async {
    return apiService.patch('/sensors/$sensorId/deactivate');
  }

  // ========== AGRI LOGISTICS ==========

  Future<ApiResponse<List<AgriculturalLogisticsShipment>>> getFarmerShipments(
    String farmerId,
  ) async {
    return apiService.get<List<AgriculturalLogisticsShipment>>(
      '/farmers/$farmerId/shipments',
      parser: (data) => (data as List)
          .map((s) => AgriculturalLogisticsShipment.fromJson(s))
          .toList(),
    );
  }

  Future<ApiResponse<AgriculturalLogisticsShipment>> createShipment(
    String farmerId,
    AgriculturalLogisticsShipment shipment,
  ) async {
    return apiService.post<AgriculturalLogisticsShipment>(
      '/farmers/$farmerId/shipments',
      data: shipment.toJson(),
      parser: (data) => AgriculturalLogisticsShipment.fromJson(data),
    );
  }

  Future<ApiResponse<AgriculturalLogisticsShipment>> updateShipmentLocation(
    String shipmentId,
    double latitude,
    double longitude,
  ) async {
    return apiService.patch<AgriculturalLogisticsShipment>(
      '/shipments/$shipmentId/location',
      data: {'latitude': latitude, 'longitude': longitude},
      parser: (data) => AgriculturalLogisticsShipment.fromJson(data),
    );
  }

  Future<ApiResponse<AgriculturalLogisticsShipment>> completeShipment(
    String shipmentId,
  ) async {
    return apiService.patch<AgriculturalLogisticsShipment>(
      '/shipments/$shipmentId/complete',
      parser: (data) => AgriculturalLogisticsShipment.fromJson(data),
    );
  }

  // ========== SAVINGS CYCLES ==========

  Future<ApiResponse<List<SavingsCycle>>> getFarmerSavingsCycles(String farmerId) async {
    return apiService.get<List<SavingsCycle>>(
      '/farmers/$farmerId/savings-cycles',
      parser: (data) => (data as List).map((s) => SavingsCycle.fromJson(s)).toList(),
    );
  }

  Future<ApiResponse<SavingsCycle>> createSavingsCycle(
    SavingsCycle cycle,
  ) async {
    return apiService.post<SavingsCycle>(
      '/savings-cycles',
      data: cycle.toJson(),
      parser: (data) => SavingsCycle.fromJson(data),
    );
  }

  Future<ApiResponse<SavingsCycle>> joinSavingsCycle(
    String cycleId,
    String farmerId,
  ) async {
    return apiService.post<SavingsCycle>(
      '/savings-cycles/$cycleId/join',
      data: {'farmerId': farmerId},
      parser: (data) => SavingsCycle.fromJson(data),
    );
  }

  Future<ApiResponse<SavingsCycle>> contributeToCycle(
    String cycleId,
    String farmerId,
    double amount,
  ) async {
    return apiService.post<SavingsCycle>(
      '/savings-cycles/$cycleId/contribute',
      data: {'farmerId': farmerId, 'amount': amount},
      parser: (data) => SavingsCycle.fromJson(data),
    );
  }

  // ========== AGRI REINSURANCE ==========

  Future<ApiResponse<List<AgriculturalReinsurance>>> getPolicyReinsurance(
    String policyId,
  ) async {
    return apiService.get<List<AgriculturalReinsurance>>(
      '/insurance-policies/$policyId/reinsurance',
      parser: (data) =>
          (data as List).map((r) => AgriculturalReinsurance.fromJson(r)).toList(),
    );
  }

  Future<ApiResponse<AgriculturalReinsurance>> addReinsurance(
    String policyId,
    AgriculturalReinsurance reinsurance,
  ) async {
    return apiService.post<AgriculturalReinsurance>(
      '/insurance-policies/$policyId/reinsurance',
      data: reinsurance.toJson(),
      parser: (data) => AgriculturalReinsurance.fromJson(data),
    );
  }

  Future<ApiResponse<AgriculturalReinsurance>> updateReinsurance(
    String reinsuranceId,
    AgriculturalReinsurance reinsurance,
  ) async {
    return apiService.put<AgriculturalReinsurance>(
      '/reinsurance/$reinsuranceId',
      data: reinsurance.toJson(),
      parser: (data) => AgriculturalReinsurance.fromJson(data),
    );
  }

  // ========== CROP YIELD PREDICTION ==========

  Future<ApiResponse<CropYieldPrediction>> predictCropYield(
    String farmId,
    String cropType,
  ) async {
    return apiService.post<CropYieldPrediction>(
      '/farms/$farmId/yield-prediction',
      data: {'cropType': cropType},
      parser: (data) => CropYieldPrediction.fromJson(data),
    );
  }

  Future<ApiResponse<List<CropYieldPrediction>>> getFarmYieldPredictions(
    String farmId,
  ) async {
    return apiService.get<List<CropYieldPrediction>>(
      '/farms/$farmId/yield-predictions',
      parser: (data) =>
          (data as List).map((p) => CropYieldPrediction.fromJson(p)).toList(),
    );
  }

  Future<ApiResponse<CropYieldPrediction>> recordActualYield(
    String predictionId,
    double actualYield,
  ) async {
    return apiService.patch<CropYieldPrediction>(
      '/yield-predictions/$predictionId/actual',
      data: {'actualYield': actualYield},
      parser: (data) => CropYieldPrediction.fromJson(data),
    );
  }

  // ========== FARM BOUNDARY MAPPING ==========

  Future<ApiResponse<FarmBoundaryMapping>> mapFarmBoundary(
    String farmId,
    FarmBoundaryMapping mapping,
  ) async {
    return apiService.post<FarmBoundaryMapping>(
      '/farms/$farmId/boundary-mapping',
      data: mapping.toJson(),
      parser: (data) => FarmBoundaryMapping.fromJson(data),
    );
  }

  Future<ApiResponse<FarmBoundaryMapping>> getFarmBoundary(String farmId) async {
    return apiService.get<FarmBoundaryMapping>(
      '/farms/$farmId/boundary-mapping',
      parser: (data) => FarmBoundaryMapping.fromJson(data),
    );
  }

  Future<ApiResponse<FarmBoundaryMapping>> updateBoundaryMapping(
    String farmId,
    FarmBoundaryMapping mapping,
  ) async {
    return apiService.put<FarmBoundaryMapping>(
      '/farms/$farmId/boundary-mapping',
      data: mapping.toJson(),
      parser: (data) => FarmBoundaryMapping.fromJson(data),
    );
  }

  Future<ApiResponse<FarmBoundaryMapping>> verifyBoundaryMapping(
    String farmId,
  ) async {
    return apiService.patch<FarmBoundaryMapping>(
      '/farms/$farmId/boundary-mapping/verify',
      parser: (data) => FarmBoundaryMapping.fromJson(data),
    );
  }

  // ========== SATELLITE MONITORING ==========

  Future<ApiResponse<List<SatelliteMonitoringData>>> getFarmSatelliteData(
    String farmId, {
    SatelliteDataType? dataType,
    DateTime? from,
    DateTime? to,
  }) async {
    final queryParams = {
      if (dataType != null) 'dataType': dataType.index,
      if (from != null) 'from': from.toIso8601String(),
      if (to != null) 'to': to.toIso8601String(),
    };

    return apiService.get<List<SatelliteMonitoringData>>(
      '/farms/$farmId/satellite-data',
      queryParameters: queryParams,
      parser: (data) => (data as List).map((s) => SatelliteMonitoringData.fromJson(s)).toList(),
    );
  }

  Future<ApiResponse<SatelliteMonitoringData>> requestSatelliteImage(
    String farmId,
    SatelliteDataType dataType,
  ) async {
    return apiService.post<SatelliteMonitoringData>(
      '/farms/$farmId/satellite-data/request',
      data: {'dataType': dataType.index},
      parser: (data) => SatelliteMonitoringData.fromJson(data),
    );
  }

  // ========== SOIL ANALYSIS ==========

  Future<ApiResponse<SoilAnalysis>> recordSoilAnalysis(
    String farmId,
    SoilAnalysis analysis,
  ) async {
    return apiService.post<SoilAnalysis>(
      '/farms/$farmId/soil-analysis',
      data: analysis.toJson(),
      parser: (data) => SoilAnalysis.fromJson(data),
    );
  }

  Future<ApiResponse<List<SoilAnalysis>>> getFarmSoilAnalysis(String farmId) async {
    return apiService.get<List<SoilAnalysis>>(
      '/farms/$farmId/soil-analysis',
      parser: (data) => (data as List).map((s) => SoilAnalysis.fromJson(s)).toList(),
    );
  }

  Future<ApiResponse<SoilAnalysis>> getLatestSoilAnalysis(String farmId) async {
    return apiService.get<SoilAnalysis>(
      '/farms/$farmId/soil-analysis/latest',
      parser: (data) => SoilAnalysis.fromJson(data),
    );
  }

  // ========== LIVESTOCK FINANCE ==========

  Future<ApiResponse<List<LivestockFinance>>> getFarmerLivestockFinance(
    String farmerId,
  ) async {
    return apiService.get<List<LivestockFinance>>(
      '/farmers/$farmerId/livestock-finance',
      parser: (data) => (data as List).map((l) => LivestockFinance.fromJson(l)).toList(),
    );
  }

  Future<ApiResponse<LivestockFinance>> applyForLivestockFinance(
    String farmerId,
    LivestockFinance finance,
  ) async {
    return apiService.post<LivestockFinance>(
      '/farmers/$farmerId/livestock-finance',
      data: finance.toJson(),
      parser: (data) => LivestockFinance.fromJson(data),
    );
  }

  Future<ApiResponse<LivestockFinance>> getLivestockFinanceDetails(
    String financeId,
  ) async {
    return apiService.get<LivestockFinance>(
      '/livestock-finance/$financeId',
      parser: (data) => LivestockFinance.fromJson(data),
    );
  }

  // ========== LIVESTOCK MANAGEMENT ==========

  Future<ApiResponse<List<LivestockRecord>>> getFarmerLivestock(String farmerId) async {
    return apiService.get<List<LivestockRecord>>(
      '/farmers/$farmerId/livestock',
      parser: (data) => (data as List).map((l) => LivestockRecord.fromJson(l)).toList(),
    );
  }

  Future<ApiResponse<LivestockRecord>> registerLivestock(
    String farmerId,
    LivestockRecord record,
  ) async {
    return apiService.post<LivestockRecord>(
      '/farmers/$farmerId/livestock',
      data: record.toJson(),
      parser: (data) => LivestockRecord.fromJson(data),
    );
  }

  Future<ApiResponse<LivestockRecord>> updateLivestockRecord(
    String livestockId,
    LivestockRecord record,
  ) async {
    return apiService.put<LivestockRecord>(
      '/livestock/$livestockId',
      data: record.toJson(),
      parser: (data) => LivestockRecord.fromJson(data),
    );
  }

  Future<ApiResponse<LivestockRecord>> updateHealthStatus(
    String livestockId,
    AnimalHealthStatus status,
  ) async {
    return apiService.patch<LivestockRecord>(
      '/livestock/$livestockId/health',
      data: {'healthStatus': status.index},
      parser: (data) => LivestockRecord.fromJson(data),
    );
  }

  // ========== COMMODITY EXCHANGE ==========

  Future<ApiResponse<List<CommodityExchangeListing>>> listCommodities({
    CommodityCategory? category,
    String? location,
    int page = 1,
  }) async {
    final queryParams = {
      if (category != null) 'category': category.index,
      if (location != null) 'location': location,
      'page': page,
    };

    return apiService.get<List<CommodityExchangeListing>>(
      '/commodity-exchange',
      queryParameters: queryParams,
      parser: (data) => (data as List)
          .map((c) => CommodityExchangeListing.fromJson(c))
          .toList(),
    );
  }

  Future<ApiResponse<CommodityExchangeListing>> createCommodityListing(
    String supplierId,
    CommodityExchangeListing listing,
  ) async {
    return apiService.post<CommodityExchangeListing>(
      '/farmers/$supplierId/commodity-listings',
      data: listing.toJson(),
      parser: (data) => CommodityExchangeListing.fromJson(data),
    );
  }

  Future<ApiResponse<CommodityExchangeListing>> updateCommodityListing(
    String listingId,
    CommodityExchangeListing listing,
  ) async {
    return apiService.put<CommodityExchangeListing>(
      '/commodity-listings/$listingId',
      data: listing.toJson(),
      parser: (data) => CommodityExchangeListing.fromJson(data),
    );
  }

  Future<ApiResponse<void>> closeCommodityListing(String listingId) async {
    return apiService.patch('/commodity-listings/$listingId/close');
  }

  // ========== WAREHOUSE MANAGEMENT ==========

  Future<ApiResponse<List<WarehouseFacility>>> listWarehouses({
    String? location,
    WarehouseFacilityType? type,
  }) async {
    final queryParams = {
      if (location != null) 'location': location,
      if (type != null) 'type': type.index,
    };

    return apiService.get<List<WarehouseFacility>>(
      '/warehouses',
      queryParameters: queryParams,
      parser: (data) => (data as List).map((w) => WarehouseFacility.fromJson(w)).toList(),
    );
  }

  Future<ApiResponse<WarehouseFacility>> getWarehouseDetails(String warehouseId) async {
    return apiService.get<WarehouseFacility>(
      '/warehouses/$warehouseId',
      parser: (data) => WarehouseFacility.fromJson(data),
    );
  }

  Future<ApiResponse<WarehouseStorage>> storeInWarehouse(
    String warehouseId,
    WarehouseStorage storage,
  ) async {
    return apiService.post<WarehouseStorage>(
      '/warehouses/$warehouseId/storage',
      data: storage.toJson(),
      parser: (data) => WarehouseStorage.fromJson(data),
    );
  }

  Future<ApiResponse<List<WarehouseStorage>>> getFarmerStorages(String farmerId) async {
    return apiService.get<List<WarehouseStorage>>(
      '/farmers/$farmerId/warehouse-storage',
      parser: (data) => (data as List).map((s) => WarehouseStorage.fromJson(s)).toList(),
    );
  }

  Future<ApiResponse<WarehouseStorage>> completeStorage(String storageId) async {
    return apiService.patch<WarehouseStorage>(
      '/warehouse-storage/$storageId/complete',
      parser: (data) => WarehouseStorage.fromJson(data),
    );
  }

  // ========== CBN AGRI RETURNS ==========

  Future<ApiResponse<List<CBNAgriculturalReturns>>> getFarmerCBNReturns(
    String farmerId,
  ) async {
    return apiService.get<List<CBNAgriculturalReturns>>(
      '/farmers/$farmerId/cbn-returns',
      parser: (data) => (data as List).map((c) => CBNAgriculturalReturns.fromJson(c)).toList(),
    );
  }

  Future<ApiResponse<CBNAgriculturalReturns>> createCBNReturn(
    String farmerId,
    CBNAgriculturalReturns returns,
  ) async {
    return apiService.post<CBNAgriculturalReturns>(
      '/farmers/$farmerId/cbn-returns',
      data: returns.toJson(),
      parser: (data) => CBNAgriculturalReturns.fromJson(data),
    );
  }

  Future<ApiResponse<CBNAgriculturalReturns>> submitCBNReturn(String returnId) async {
    return apiService.patch<CBNAgriculturalReturns>(
      '/cbn-returns/$returnId/submit',
      parser: (data) => CBNAgriculturalReturns.fromJson(data),
    );
  }

  // ========== NIRSAL AGROGEO COOP ==========

  Future<ApiResponse<List<NIRSALAgroCoop>>> listNIRSALCoops({
    String? location,
  }) async {
    final queryParams = {
      if (location != null) 'location': location,
    };

    return apiService.get<List<NIRSALAgroCoop>>(
      '/nirsal-coops',
      queryParameters: queryParams,
      parser: (data) => (data as List).map((n) => NIRSALAgroCoop.fromJson(n)).toList(),
    );
  }

  Future<ApiResponse<NIRSALAgroCoop>> getNIRSALCoopDetails(String coopId) async {
    return apiService.get<NIRSALAgroCoop>(
      '/nirsal-coops/$coopId',
      parser: (data) => NIRSALAgroCoop.fromJson(data),
    );
  }

  Future<ApiResponse<NIRSALAgroCoop>> joinNIRSALCoop(
    String coopId,
    String farmerId,
  ) async {
    return apiService.post<NIRSALAgroCoop>(
      '/nirsal-coops/$coopId/join',
      data: {'farmerId': farmerId},
      parser: (data) => NIRSALAgroCoop.fromJson(data),
    );
  }

  // ========== ANCHOR BORROWERS ==========

  Future<ApiResponse<List<AnchorBorrowerProgram>>> getFarmerAnchorPrograms(
    String farmerId,
  ) async {
    return apiService.get<List<AnchorBorrowerProgram>>(
      '/farmers/$farmerId/anchor-borrower',
      parser: (data) => (data as List).map((a) => AnchorBorrowerProgram.fromJson(a)).toList(),
    );
  }

  Future<ApiResponse<AnchorBorrowerProgram>> applyForAnchorProgram(
    String farmerId,
    AnchorBorrowerProgram program,
  ) async {
    return apiService.post<AnchorBorrowerProgram>(
      '/farmers/$farmerId/anchor-borrower',
      data: program.toJson(),
      parser: (data) => AnchorBorrowerProgram.fromJson(data),
    );
  }

  Future<ApiResponse<AnchorBorrowerProgram>> getAnchorProgramDetails(
    String programId,
  ) async {
    return apiService.get<AnchorBorrowerProgram>(
      '/anchor-borrower/$programId',
      parser: (data) => AnchorBorrowerProgram.fromJson(data),
    );
  }

  Future<ApiResponse<AnchorBorrowerProgram>> updateAnchorProgram(
    String programId,
    AnchorBorrowerProgram program,
  ) async {
    return apiService.put<AnchorBorrowerProgram>(
      '/anchor-borrower/$programId',
      data: program.toJson(),
      parser: (data) => AnchorBorrowerProgram.fromJson(data),
    );
  }

  Future<ApiResponse<void>> completeAnchorProgram(String programId) async {
    return apiService.patch('/anchor-borrower/$programId/complete');
  }
}

/// Riverpod Provider for Extended Agricultural Service
final extendedAgriculturalServiceProvider = Provider<ExtendedAgriculturalService>((ref) {
  return ExtendedAgriculturalService();
});
