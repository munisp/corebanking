import 'package:riverpod/riverpod.dart';
import '../models/agriculture_models_extended.dart';
import '../services/extended_agriculture_service.dart';

/// Extended State Notifiers and Providers
/// Manages state for all 19 agricultural features
/// Full CRUD operations with AsyncValue state management

// ========== AGRI PARTNERS NOTIFIER ==========

class PartnersNotifier extends StateNotifier<AsyncValue<List<AgriculturalPartner>>> {
  final ExtendedAgriculturalService service;

  PartnersNotifier(this.service) : super(const AsyncValue.loading());

  Future<void> loadPartners({
    PartnershipType? type,
    String? location,
  }) async {
    state = const AsyncValue.loading();
    final result = await service.listPartners(type: type, location: location);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<AgriculturalPartner?> createPartner(AgriculturalPartner partner) async {
    final result = await service.createPartner(partner);
    return result.fold(
      (error, _) {
        state = AsyncValue.error(error, StackTrace.current);
        return null;
      },
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }
}

// ========== AGRI RISK NOTIFIER ==========

class RisksNotifier extends StateNotifier<AsyncValue<List<AgriculturalRisk>>> {
  final ExtendedAgriculturalService service;
  final String farmId;

  RisksNotifier(this.service, this.farmId) : super(const AsyncValue.loading());

  Future<void> loadRisks() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmRisks(farmId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<AgriculturalRisk?> createRisk(AgriculturalRisk risk) async {
    final result = await service.createRiskAssessment(farmId, risk);
    return result.fold(
      (error, _) {
        state = AsyncValue.error(error, StackTrace.current);
        return null;
      },
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> resolveRisk(String riskId) async {
    final result = await service.resolveRisk(farmId, riskId);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadRisks();
        return true;
      },
    );
  }
}

// ========== AGRI E-VOUCHER NOTIFIER ==========

class EVouchersNotifier extends StateNotifier<AsyncValue<List<AgriculturalEVoucher>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  EVouchersNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadVouchers() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerVouchers(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<AgriculturalEVoucher?> redeemVoucher(String voucherId, String partnerId) async {
    final result = await service.redeemVoucher(voucherId, partnerId);
    return result.fold(
      (error, _) => null,
      (data, __) {
        loadVouchers();
        return data;
      },
    );
  }

  Future<AgriculturalEVoucher?> transferVoucher(String voucherId, String targetFarmerId) async {
    final result = await service.transferVoucher(voucherId, targetFarmerId);
    return result.fold(
      (error, _) => null,
      (data, __) {
        loadVouchers();
        return data;
      },
    );
  }
}

// ========== IOT SENSORS NOTIFIER ==========

class IoTSensorsNotifier extends StateNotifier<AsyncValue<List<IoTSensor>>> {
  final ExtendedAgriculturalService service;
  final String farmId;

  IoTSensorsNotifier(this.service, this.farmId) : super(const AsyncValue.loading());

  Future<void> loadSensors() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmSensors(farmId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<IoTSensor?> installSensor(IoTSensor sensor) async {
    final result = await service.installSensor(farmId, sensor);
    return result.fold(
      (error, _) {
        state = AsyncValue.error(error, StackTrace.current);
        return null;
      },
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }
}

// ========== SENSOR READINGS NOTIFIER ==========

class SensorReadingsNotifier extends StateNotifier<AsyncValue<List<SensorReading>>> {
  final ExtendedAgriculturalService service;
  final String sensorId;

  SensorReadingsNotifier(this.service, this.sensorId) : super(const AsyncValue.loading());

  Future<void> loadReadings({DateTime? from, DateTime? to}) async {
    state = const AsyncValue.loading();
    final result = await service.getSensorReadings(sensorId, from: from, to: to);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<void> loadLatestReading() async {
    final result = await service.getLatestReading(sensorId);
    result.fold(
      (error, _) => state = AsyncValue.error(error, StackTrace.current),
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        if (current.isNotEmpty) {
          current[0] = data;
        } else {
          state = AsyncValue.data([data]);
        }
      },
    );
  }
}

// ========== AGRI LOGISTICS NOTIFIER ==========

class LogisticsShipmentsNotifier extends StateNotifier<AsyncValue<List<AgriculturalLogisticsShipment>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  LogisticsShipmentsNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadShipments() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerShipments(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<AgriculturalLogisticsShipment?> createShipment(
    AgriculturalLogisticsShipment shipment,
  ) async {
    final result = await service.createShipment(farmerId, shipment);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> updateLocation(String shipmentId, double lat, double lng) async {
    final result = await service.updateShipmentLocation(shipmentId, lat, lng);
    return result.fold((error, _) => false, (data, __) => true);
  }

  Future<bool> completeShipment(String shipmentId) async {
    final result = await service.completeShipment(shipmentId);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadShipments();
        return true;
      },
    );
  }
}

// ========== SAVINGS CYCLES NOTIFIER ==========

class SavingsCyclesNotifier extends StateNotifier<AsyncValue<List<SavingsCycle>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  SavingsCyclesNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadCycles() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerSavingsCycles(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<SavingsCycle?> createCycle(SavingsCycle cycle) async {
    final result = await service.createSavingsCycle(cycle);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> joinCycle(String cycleId) async {
    final result = await service.joinSavingsCycle(cycleId, farmerId);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadCycles();
        return true;
      },
    );
  }

  Future<bool> contribute(String cycleId, double amount) async {
    final result = await service.contributeToCycle(cycleId, farmerId, amount);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadCycles();
        return true;
      },
    );
  }
}

// ========== LIVESTOCK FINANCE NOTIFIER ==========

class LivestockFinanceNotifier extends StateNotifier<AsyncValue<List<LivestockFinance>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  LivestockFinanceNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadFinances() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerLivestockFinance(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<LivestockFinance?> applyForFinance(LivestockFinance finance) async {
    final result = await service.applyForLivestockFinance(farmerId, finance);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }
}

// ========== LIVESTOCK RECORDS NOTIFIER ==========

class LivestockRecordsNotifier extends StateNotifier<AsyncValue<List<LivestockRecord>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  LivestockRecordsNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadLivestock() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerLivestock(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<LivestockRecord?> registerLivestock(LivestockRecord record) async {
    final result = await service.registerLivestock(farmerId, record);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> updateHealthStatus(String livestockId, AnimalHealthStatus status) async {
    final result = await service.updateHealthStatus(livestockId, status);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadLivestock();
        return true;
      },
    );
  }
}

// ========== COMMODITY EXCHANGE NOTIFIER ==========

class CommodityExchangeNotifier
    extends StateNotifier<AsyncValue<List<CommodityExchangeListing>>> {
  final ExtendedAgriculturalService service;

  CommodityExchangeNotifier(this.service) : super(const AsyncValue.loading());

  Future<void> loadCommodities({
    CommodityCategory? category,
    String? location,
  }) async {
    state = const AsyncValue.loading();
    final result = await service.listCommodities(category: category, location: location);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<CommodityExchangeListing?> createListing(
    String supplierId,
    CommodityExchangeListing listing,
  ) async {
    final result = await service.createCommodityListing(supplierId, listing);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> closeListing(String listingId) async {
    final result = await service.closeCommodityListing(listingId);
    return result.fold((error, _) => false, (data, __) => true);
  }
}

// ========== WAREHOUSE NOTIFIER ==========

class WarehousesNotifier extends StateNotifier<AsyncValue<List<WarehouseFacility>>> {
  final ExtendedAgriculturalService service;

  WarehousesNotifier(this.service) : super(const AsyncValue.loading());

  Future<void> loadWarehouses({String? location}) async {
    state = const AsyncValue.loading();
    final result = await service.listWarehouses(location: location);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }
}

// ========== WAREHOUSE STORAGE NOTIFIER ==========

class WarehouseStorageNotifier extends StateNotifier<AsyncValue<List<WarehouseStorage>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  WarehouseStorageNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadStorages() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerStorages(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<WarehouseStorage?> storeItem(String warehouseId, WarehouseStorage storage) async {
    final result = await service.storeInWarehouse(warehouseId, storage);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> completeStorage(String storageId) async {
    final result = await service.completeStorage(storageId);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadStorages();
        return true;
      },
    );
  }
}

// ========== CBN RETURNS NOTIFIER ==========

class CBNReturnsNotifier extends StateNotifier<AsyncValue<List<CBNAgriculturalReturns>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  CBNReturnsNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadReturns() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerCBNReturns(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<CBNAgriculturalReturns?> createReturn(CBNAgriculturalReturns returns) async {
    final result = await service.createCBNReturn(farmerId, returns);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> submitReturn(String returnId) async {
    final result = await service.submitCBNReturn(returnId);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadReturns();
        return true;
      },
    );
  }
}

// ========== ANCHOR BORROWER NOTIFIER ==========

class AnchorBorrowerNotifier extends StateNotifier<AsyncValue<List<AnchorBorrowerProgram>>> {
  final ExtendedAgriculturalService service;
  final String farmerId;

  AnchorBorrowerNotifier(this.service, this.farmerId) : super(const AsyncValue.loading());

  Future<void> loadPrograms() async {
    state = const AsyncValue.loading();
    final result = await service.getFarmerAnchorPrograms(farmerId);
    state = result.fold(
      (error, _) => AsyncValue.error(error, StackTrace.current),
      (data, __) => AsyncValue.data(data),
    );
  }

  Future<AnchorBorrowerProgram?> applyForProgram(AnchorBorrowerProgram program) async {
    final result = await service.applyForAnchorProgram(farmerId, program);
    return result.fold(
      (error, _) => null,
      (data, __) {
        final current = state.maybeWhen(data: (d) => d, orElse: () => []);
        state = AsyncValue.data([...current, data]);
        return data;
      },
    );
  }

  Future<bool> completeProgram(String programId) async {
    final result = await service.completeAnchorProgram(programId);
    return result.fold(
      (error, _) => false,
      (data, __) {
        loadPrograms();
        return true;
      },
    );
  }
}

// ========== RIVERPOD PROVIDERS ==========

// Partners
final extendedPartnersProvider = StateNotifierProvider<
    PartnersNotifier,
    AsyncValue<List<AgriculturalPartner>>>((ref) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return PartnersNotifier(service);
});

// Risks
final farmsRisksProvider = StateNotifierProvider.family<
    RisksNotifier,
    AsyncValue<List<AgriculturalRisk>>,
    String>((ref, farmId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return RisksNotifier(service, farmId);
});

// E-Vouchers
final farmerEVouchersProvider = StateNotifierProvider.family<
    EVouchersNotifier,
    AsyncValue<List<AgriculturalEVoucher>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return EVouchersNotifier(service, farmerId);
});

// IoT Sensors
final farmSensorsProvider = StateNotifierProvider.family<
    IoTSensorsNotifier,
    AsyncValue<List<IoTSensor>>,
    String>((ref, farmId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return IoTSensorsNotifier(service, farmId);
});

// Sensor Readings
final sensorReadingsProvider = StateNotifierProvider.family<
    SensorReadingsNotifier,
    AsyncValue<List<SensorReading>>,
    String>((ref, sensorId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return SensorReadingsNotifier(service, sensorId);
});

// Logistics Shipments
final farmerShipmentsProvider = StateNotifierProvider.family<
    LogisticsShipmentsNotifier,
    AsyncValue<List<AgriculturalLogisticsShipment>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return LogisticsShipmentsNotifier(service, farmerId);
});

// Savings Cycles
final farmerSavingsCyclesProvider = StateNotifierProvider.family<
    SavingsCyclesNotifier,
    AsyncValue<List<SavingsCycle>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return SavingsCyclesNotifier(service, farmerId);
});

// Livestock Finance
final farmerLivestockFinanceProvider = StateNotifierProvider.family<
    LivestockFinanceNotifier,
    AsyncValue<List<LivestockFinance>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return LivestockFinanceNotifier(service, farmerId);
});

// Livestock Records
final farmerLivestockProvider = StateNotifierProvider.family<
    LivestockRecordsNotifier,
    AsyncValue<List<LivestockRecord>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return LivestockRecordsNotifier(service, farmerId);
});

// Commodity Exchange
final commodityExchangeProvider =
    StateNotifierProvider<CommodityExchangeNotifier, AsyncValue<List<CommodityExchangeListing>>>(
        (ref) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return CommodityExchangeNotifier(service);
});

// Warehouses
final warehousesProvider =
    StateNotifierProvider<WarehousesNotifier, AsyncValue<List<WarehouseFacility>>>((ref) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return WarehousesNotifier(service);
});

// Warehouse Storage
final farmerWarehouseStorageProvider = StateNotifierProvider.family<
    WarehouseStorageNotifier,
    AsyncValue<List<WarehouseStorage>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return WarehouseStorageNotifier(service, farmerId);
});

// CBN Returns
final farmerCBNReturnsProvider = StateNotifierProvider.family<
    CBNReturnsNotifier,
    AsyncValue<List<CBNAgriculturalReturns>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return CBNReturnsNotifier(service, farmerId);
});

// Anchor Borrower
final farmerAnchorBorrowerProvider = StateNotifierProvider.family<
    AnchorBorrowerNotifier,
    AsyncValue<List<AnchorBorrowerProgram>>,
    String>((ref, farmerId) {
  final service = ref.watch(extendedAgriculturalServiceProvider);
  return AnchorBorrowerNotifier(service, farmerId);
});
