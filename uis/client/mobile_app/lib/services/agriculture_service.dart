import 'package:flutter/foundation.dart' show kDebugMode;
import 'api_service.dart';
import '../config/app_config.dart';

class AgricultureService {
  AgricultureService._();
  static final AgricultureService instance = AgricultureService._();

  final ApiService _api = ApiService();

  void _log(String endpoint, dynamic data) {
    // MOB-04: full-payload logging gated to debug builds (was print() in
    // release — log-throttle jank + data leak on large lists).
    if (kDebugMode) {
      print("AGRICULTURE RESPONSE [$endpoint]: $data");
    }
  }

  String get base => AppConfig.agricultureEndpoint;

  // ================= CROPS =================
  Future<dynamic> listCrops({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/crops", queryParameters: {'page': page, 'limit': limit});
    _log("/crops", res.data);
    return res.data;
  }

  Future<dynamic> getCropDetails(String cropType) async {
    final res = await _api.get("$base/crops/$cropType");
    _log("/crops/$cropType", res.data);
    return res.data;
  }

  // ================= LIVESTOCK =================
  Future<dynamic> listLivestock({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/livestock", queryParameters: {'page': page, 'limit': limit});
    _log("/livestock", res.data);
    return res.data;
  }

  Future<dynamic> getLivestockDetails(String type) async {
    final res = await _api.get("$base/livestock/$type");
    _log("/livestock/$type", res.data);
    return res.data;
  }

  // ================= FARMERS =================
  Future<dynamic> listFarmers({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/farmers", queryParameters: {'page': page, 'limit': limit});
    _log("/farmers", res.data);
    return res.data;
  }

  Future<dynamic> registerFarmer(Map data) async {
    final res = await _api.post("$base/farmers", data: data);
    _log("/farmers (create)", res.data);
    return res.data;
  }

  Future<dynamic> getFarmer(String id) async {
    final res = await _api.get("$base/farmers/$id");
    _log("/farmers/$id", res.data);
    return res.data;
  }

  Future<dynamic> getFarmerFarms(String id, {int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/farmers/$id/farms", queryParameters: {'page': page, 'limit': limit});
    _log("/farmers/$id/farms", res.data);
    return res.data;
  }

  // ================= FARMS =================
  Future<dynamic> listFarms({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/farms", queryParameters: {'page': page, 'limit': limit});
    _log("/farms", res.data);
    return res.data;
  }

  Future<dynamic> registerFarm(Map data) async {
    final res = await _api.post("$base/farms", data: data);
    _log("/farms (create)", res.data);
    return res.data;
  }

  Future<dynamic> verifyFarm(String id, Map data) async {
    final res = await _api.post("$base/farms/$id/verify", data: data);
    _log("/farms/$id/verify", res.data);
    return res.data;
  }

  // ================= LOANS =================
  Future<dynamic> listLoans({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/loans", queryParameters: {'page': page, 'limit': limit});
    _log("/loans", res.data);
    return res.data;
  }

  Future<dynamic> applyLoan(Map data) async {
    final res = await _api.post("$base/loans/apply", data: data);
    _log("/loans/apply", res.data);
    return res.data;
  }

  Future<dynamic> assessLoan(Map data) async {
    final res = await _api.post("$base/loans/assess", data: data);
    _log("/loans/assess", res.data);
    return res.data;
  }

  Future<dynamic> disburseLoan(String id) async {
    final res = await _api.post("$base/loans/$id/disburse");
    _log("/loans/$id/disburse", res.data);
    return res.data;
  }

  Future<dynamic> repayLoan(String id, Map data) async {
    final res = await _api.post("$base/loans/$id/repay", data: data);
    _log("/loans/$id/repay", res.data);
    return res.data;
  }

  // ================= COOPERATIVES =================
  Future<dynamic> listCooperatives({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/cooperatives", queryParameters: {'page': page, 'limit': limit});
    _log("/cooperatives", res.data);
    return res.data;
  }

  Future<dynamic> registerCooperative(Map data) async {
    final res = await _api.post("$base/cooperatives", data: data);
    _log("/cooperatives (create)", res.data);
    return res.data;
  }

  // ================= WEATHER =================
  Future<dynamic> getWeather(String location) async {
    final res = await _api.get("$base/weather/$location");
    _log("/weather/$location", res.data);
    return res.data;
  }

  Future<dynamic> getWeatherRisk(String location) async {
    final res = await _api.get("$base/weather/$location/risk");
    _log("/weather/$location/risk", res.data);
    return res.data;
  }

  // ================= PRICES =================
  Future<dynamic> getPrice(String commodity) async {
    final res = await _api.get("$base/prices/$commodity");
    _log("/prices/$commodity", res.data);
    return res.data;
  }

  Future<dynamic> getPriceHistory(String commodity, {int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/prices/$commodity/history", queryParameters: {'page': page, 'limit': limit});
    _log("/prices/$commodity/history", res.data);
    return res.data;
  }

  // ================= INSURANCE =================
  Future<dynamic> insuranceQuote(Map data) async {
    final res = await _api.post("$base/insurance/quote", data: data);
    _log("/insurance/quote", res.data);
    return res.data;
  }

  Future<dynamic> purchaseInsurance(Map data) async {
    final res = await _api.post("$base/insurance/purchase", data: data);
    _log("/insurance/purchase", res.data);
    return res.data;
  }

  // ================= ANALYTICS =================
  Future<dynamic> portfolioAnalytics() async {
    final res = await _api.get("$base/analytics/portfolio");
    _log("/analytics/portfolio", res.data);
    return res.data;
  }

  Future<dynamic> riskAnalytics() async {
    final res = await _api.get("$base/analytics/risk");
    _log("/analytics/risk", res.data);
    return res.data;
  }

  // ================= PROGRAMS =================
  Future<dynamic> listPrograms({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/programs", queryParameters: {'page': page, 'limit': limit});
    _log("/programs", res.data);
    return res.data;
  }

  Future<dynamic> createProgram(Map data) async {
    final res = await _api.post("$base/programs", data: data);
    _log("/programs (create)", res.data);
    return res.data;
  }

  Future<dynamic> getProgram(String id) async {
    final res = await _api.get("$base/programs/$id");
    _log("/programs/$id", res.data);
    return res.data;
  }

  // ================= PARTNERS =================
  Future<dynamic> listPartners({int page = 1, int limit = 50}) async {
    final res = await _api.get("$base/partners", queryParameters: {'page': page, 'limit': limit});
    _log("/partners", res.data);
    return res.data;
  }

  Future<dynamic> registerPartner(Map data) async {
    final res = await _api.post("$base/partners", data: data);
    _log("/partners (create)", res.data);
    return res.data;
  }

  Future<dynamic> getPartner(String id) async {
    final res = await _api.get("$base/partners/$id");
    _log("/partners/$id", res.data);
    return res.data;
  }

  // ================= INPUT SUPPLIERS =================
  Future<dynamic> registerInputSupplier(Map data) async {
    final res = await _api.post("$base/input-suppliers", data: data);
    _log("/input-suppliers", res.data);
    return res.data;
  }

  Future<dynamic> getInputSupplier(String id) async {
    final res = await _api.get("$base/input-suppliers/$id");
    _log("/input-suppliers/$id", res.data);
    return res.data;
  }

  Future<dynamic> createInputOrder(String id, Map data) async {
    final res = await _api.post("$base/input-suppliers/$id/orders", data: data);
    _log("/input-suppliers/$id/orders", res.data);
    return res.data;
  }

  // ================= OFF-TAKERS =================
  Future<dynamic> registerOffTaker(Map data) async {
    final res = await _api.post("$base/off-takers", data: data);
    _log("/off-takers", res.data);
    return res.data;
  }

  Future<dynamic> getOffTaker(String id) async {
    final res = await _api.get("$base/off-takers/$id");
    _log("/off-takers/$id", res.data);
    return res.data;
  }

  Future<dynamic> createContract(String id, Map data) async {
    final res = await _api.post("$base/off-takers/$id/contracts", data: data);
    _log("/off-takers/$id/contracts", res.data);
    return res.data;
  }

  // ================= HEALTH =================
  Future<dynamic> health() async {
    final res = await _api.get("/health");
    _log("/health", res.data);
    return res.data;
  }

  // ================= MERGED DOMAIN SERVICES =================
  // Routes served by the agricultural-service after merging standalone services

  String get mergedBase => '/agricultural/api/v1';

  // Animal ID Traceability
  Future<dynamic> listAnimalTraceability({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/animal-id-traceability/list", queryParameters: {'page': page, 'limit': limit});
    _log("/animal-id-traceability/list", res.data);
    return res.data;
  }

  Future<dynamic> createAnimalTraceability(Map data) async {
    final res = await _api.post("$mergedBase/animal-id-traceability/create", data: data);
    _log("/animal-id-traceability/create", res.data);
    return res.data;
  }

  Future<dynamic> getAnimalTraceabilityStats() async {
    final res = await _api.get("$mergedBase/animal-id-traceability/stats");
    _log("/animal-id-traceability/stats", res.data);
    return res.data;
  }

  // Area Yield Index Insurance
  Future<dynamic> listAreaYieldIndexInsurance({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/area-yield-index-insurance/list", queryParameters: {'page': page, 'limit': limit});
    _log("/area-yield-index-insurance/list", res.data);
    return res.data;
  }

  Future<dynamic> createAreaYieldIndexInsurance(Map data) async {
    final res = await _api.post("$mergedBase/area-yield-index-insurance/create", data: data);
    _log("/area-yield-index-insurance/create", res.data);
    return res.data;
  }

  Future<dynamic> getAreaYieldIndexStats() async {
    final res = await _api.get("$mergedBase/area-yield-index-insurance/stats");
    _log("/area-yield-index-insurance/stats", res.data);
    return res.data;
  }

  // Crop Yield Prediction
  Future<dynamic> listCropYieldPredictions({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/crop-yield-prediction/list", queryParameters: {'page': page, 'limit': limit});
    _log("/crop-yield-prediction/list", res.data);
    return res.data;
  }

  Future<dynamic> createCropYieldPrediction(Map data) async {
    final res = await _api.post("$mergedBase/crop-yield-prediction/create", data: data);
    _log("/crop-yield-prediction/create", res.data);
    return res.data;
  }

  Future<dynamic> getCropYieldPredictionStats() async {
    final res = await _api.get("$mergedBase/crop-yield-prediction/stats");
    _log("/crop-yield-prediction/stats", res.data);
    return res.data;
  }

  // Farm Boundary Mapping
  Future<dynamic> listFarmBoundaryMappings({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/farm-boundary-mapping/list", queryParameters: {'page': page, 'limit': limit});
    _log("/farm-boundary-mapping/list", res.data);
    return res.data;
  }

  Future<dynamic> createFarmBoundaryMapping(Map data) async {
    final res = await _api.post("$mergedBase/farm-boundary-mapping/create", data: data);
    _log("/farm-boundary-mapping/create", res.data);
    return res.data;
  }

  Future<dynamic> getFarmBoundaryMappingStats() async {
    final res = await _api.get("$mergedBase/farm-boundary-mapping/stats");
    _log("/farm-boundary-mapping/stats", res.data);
    return res.data;
  }

  // Livestock Finance
  Future<dynamic> listLivestockFinance({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/livestock-finance/list", queryParameters: {'page': page, 'limit': limit});
    _log("/livestock-finance/list", res.data);
    return res.data;
  }

  Future<dynamic> createLivestockFinanceLoan(Map data) async {
    final res = await _api.post("$mergedBase/livestock-finance/create", data: data);
    _log("/livestock-finance/create", res.data);
    return res.data;
  }

  Future<dynamic> getLivestockFinanceStats() async {
    final res = await _api.get("$mergedBase/livestock-finance/stats");
    _log("/livestock-finance/stats", res.data);
    return res.data;
  }

  // Fisheries & Aquaculture
  Future<dynamic> listFisheriesAquaculture({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/fisheries-aquaculture/list", queryParameters: {'page': page, 'limit': limit});
    _log("/fisheries-aquaculture/list", res.data);
    return res.data;
  }

  Future<dynamic> createFisheriesAquacultureFacility(Map data) async {
    final res = await _api.post("$mergedBase/fisheries-aquaculture/create", data: data);
    _log("/fisheries-aquaculture/create", res.data);
    return res.data;
  }

  Future<dynamic> getFisheriesAquacultureStats() async {
    final res = await _api.get("$mergedBase/fisheries-aquaculture/stats");
    _log("/fisheries-aquaculture/stats", res.data);
    return res.data;
  }

  // Livestock Insurance
  Future<dynamic> listLivestockInsurance({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/livestock-insurance/list", queryParameters: {'page': page, 'limit': limit});
    _log("/livestock-insurance/list", res.data);
    return res.data;
  }

  Future<dynamic> createLivestockInsurancePolicy(Map data) async {
    final res = await _api.post("$mergedBase/livestock-insurance/create", data: data);
    _log("/livestock-insurance/create", res.data);
    return res.data;
  }

  Future<dynamic> getLivestockInsuranceStats() async {
    final res = await _api.get("$mergedBase/livestock-insurance/stats");
    _log("/livestock-insurance/stats", res.data);
    return res.data;
  }

  // Livestock Management
  Future<dynamic> listLivestockHerds({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/livestock-management/list", queryParameters: {'page': page, 'limit': limit});
    _log("/livestock-management/list", res.data);
    return res.data;
  }

  Future<dynamic> createLivestockHerd(Map data) async {
    final res = await _api.post("$mergedBase/livestock-management/create", data: data);
    _log("/livestock-management/create", res.data);
    return res.data;
  }

  Future<dynamic> getLivestockManagementStats() async {
    final res = await _api.get("$mergedBase/livestock-management/stats");
    _log("/livestock-management/stats", res.data);
    return res.data;
  }

  // Satellite Crop Monitor
  Future<dynamic> listSatelliteCropMonitor({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/satellite-crop-monitor/list", queryParameters: {'page': page, 'limit': limit});
    _log("/satellite-crop-monitor/list", res.data);
    return res.data;
  }

  Future<dynamic> requestSatelliteCropScan(Map data) async {
    final res = await _api.post("$mergedBase/satellite-crop-monitor/create", data: data);
    _log("/satellite-crop-monitor/create", res.data);
    return res.data;
  }

  Future<dynamic> getSatelliteCropMonitorStats() async {
    final res = await _api.get("$mergedBase/satellite-crop-monitor/stats");
    _log("/satellite-crop-monitor/stats", res.data);
    return res.data;
  }

  // Soil Analysis
  Future<dynamic> listSoilAnalysis({int page = 1, int limit = 50}) async {
    final res = await _api.get("$mergedBase/soil-analysis/list", queryParameters: {'page': page, 'limit': limit});
    _log("/soil-analysis/list", res.data);
    return res.data;
  }

  Future<dynamic> submitSoilSample(Map data) async {
    final res = await _api.post("$mergedBase/soil-analysis/create", data: data);
    _log("/soil-analysis/create", res.data);
    return res.data;
  }

  Future<dynamic> getSoilAnalysisStats() async {
    final res = await _api.get("$mergedBase/soil-analysis/stats");
    _log("/soil-analysis/stats", res.data);
    return res.data;
  }
}