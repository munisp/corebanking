import 'package:riverpod/riverpod.dart';
import '../models/agriculture_models.dart';
import '../services/enhanced_agriculture_service.dart';
import '../utils/error_handler.dart';

// ==================== STATE NOTIFIERS ====================

/// Farmer Profile State Notifier
class FarmerProfileNotifier extends StateNotifier<AsyncValue<FarmerProfile?>> {
  FarmerProfileNotifier() : super(const AsyncValue.data(null));

  final _service = agricultureService;

  Future<void> loadFarmerProfile(String farmerId) async {
    state = const AsyncValue.loading();
    final response = await _service.getFarmerProfile(farmerId);
    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  Future<void> registerFarmer({
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
  }) async {
    state = const AsyncValue.loading();
    final response = await _service.registerFarmer(
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      farmerType: farmerType,
      farmLocation: farmLocation,
      farmSize: farmSize,
      primaryCrops: primaryCrops,
      secondaryCrops: secondaryCrops,
      yearsOfExperience: yearsOfExperience,
      latitude: latitude,
      longitude: longitude,
    );

    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  Future<void> updateProfile({
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
    if (state.value == null) return;

    state = const AsyncValue.loading();
    final response = await _service.updateFarmerProfile(
      state.value!.id,
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      farmLocation: farmLocation,
      farmSize: farmSize,
      primaryCrops: primaryCrops,
      secondaryCrops: secondaryCrops,
      latitude: latitude,
      longitude: longitude,
    );

    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  void clear() {
    state = const AsyncValue.data(null);
  }
}

/// Agricultural Loans Notifier
class AgriculturalLoansNotifier extends StateNotifier<AsyncValue<List<AgriculturalLoan>>> {
  AgriculturalLoansNotifier() : super(const AsyncValue.data([]));

  final _service = agricultureService;
  String? _currentFarmerId;

  Future<void> loadFarmerLoans(String farmerId) async {
    _currentFarmerId = farmerId;
    state = const AsyncValue.loading();
    final response = await _service.getFarmerLoans(farmerId);
    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  Future<AgriculturalLoan?> applyForLoan({
    required String farmerId,
    String? farmId,
    required double amount,
    required int tenorMonths,
    required String purpose,
    String? collateral,
  }) async {
    final response = await _service.applyForLoan(
      farmerId: farmerId,
      farmId: farmId,
      amount: amount,
      tenorMonths: tenorMonths,
      purpose: purpose,
      collateral: collateral,
    );

    final loan = response.fold<AgriculturalLoan?>(
      (error, statusCode) => null,
      (data, isFromCache) => data,
    );

    if (loan != null && _currentFarmerId == farmerId) {
      final currentLoans = state.value ?? [];
      state = AsyncValue.data([...currentLoans, loan]);
    }

    return loan;
  }

  Future<AgriculturalLoan?> getLoanDetails(String loanId) async {
    final response = await _service.getLoanDetails(loanId);
    return response.fold(
      (error, statusCode) => null,
      (data, isFromCache) => data,
    );
  }

  void clear() {
    _currentFarmerId = null;
    state = const AsyncValue.data([]);
  }
}

/// Cooperatives Notifier
class CooperativesNotifier extends StateNotifier<AsyncValue<List<CooperativeSavings>>> {
  CooperativesNotifier() : super(const AsyncValue.data([]));

  final _service = agricultureService;
  String? _currentFarmerId;

  Future<void> loadFarmerCooperatives(String farmerId) async {
    _currentFarmerId = farmerId;
    state = const AsyncValue.loading();
    final response = await _service.getFarmerCooperatives(farmerId);
    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  Future<bool> joinCooperative({
    required String farmerId,
    required String cooperativeId,
  }) async {
    final response = await _service.joinCooperative(
      farmerId: farmerId,
      cooperativeId: cooperativeId,
    );

    return response.fold(
      (error, statusCode) {
        return false;
      },
      (data, isFromCache) {
        if (_currentFarmerId == farmerId) {
          final current = state.value ?? [];
          if (!current.any((c) => c.id == data.id)) {
            state = AsyncValue.data([...current, data]);
          }
        }
        return true;
      },
    );
  }

  Future<Transaction?> contribute({
    required String cooperativeId,
    required String farmerId,
    required double amount,
  }) async {
    final response = await _service.contributeToCooperative(
      cooperativeId: cooperativeId,
      farmerId: farmerId,
      amount: amount,
    );

    return response.fold(
      (error, statusCode) => null,
      (data, isFromCache) => data,
    );
  }

  void clear() {
    _currentFarmerId = null;
    state = const AsyncValue.data([]);
  }
}

/// Marketplace Notifier
class MarketplaceNotifier extends StateNotifier<AsyncValue<List<MarketplaceListing>>> {
  MarketplaceNotifier() : super(const AsyncValue.data([]));

  final _service = agricultureService;

  Future<void> loadListings({
    String? cropType,
    int limit = 50,
  }) async {
    state = const AsyncValue.loading();
    final response = await _service.listMarketplaceListings(
      cropType: cropType,
      limit: limit,
    );

    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  Future<MarketplaceListing?> createListing({
    required String farmerId,
    required String cropType,
    required double quantityTonnes,
    required double pricePerTonne,
    required String location,
    String? imageUrl,
  }) async {
    final response = await _service.createMarketplaceListing(
      farmerId: farmerId,
      cropType: cropType,
      quantityTonnes: quantityTonnes,
      pricePerTonne: pricePerTonne,
      location: location,
      imageUrl: imageUrl,
    );

    final listing = response.fold<MarketplaceListing?>(
      (error, statusCode) => null,
      (data, isFromCache) => data,
    );

    if (listing != null) {
      final current = state.value ?? [];
      state = AsyncValue.data([listing, ...current]);
    }

    return listing;
  }

  void clear() {
    state = const AsyncValue.data([]);
  }
}

/// Farms Notifier
class FarmsNotifier extends StateNotifier<AsyncValue<List<Farm>>> {
  FarmsNotifier() : super(const AsyncValue.data([]));

  final _service = agricultureService;

  Future<void> loadFarmerFarms(String farmerId) async {
    state = const AsyncValue.loading();
    final response = await _service.getFarmerFarms(farmerId);
    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  Future<Farm?> registerFarm({
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
    final response = await _service.registerFarm(
      farmerId: farmerId,
      name: name,
      location: location,
      latitude: latitude,
      longitude: longitude,
      sizeHectares: sizeHectares,
      soilType: soilType,
      climate: climate,
      crops: crops,
    );

    final farm = response.fold<Farm?>(
      (error, statusCode) => null,
      (data, isFromCache) => data,
    );

    if (farm != null) {
      final current = state.value ?? [];
      state = AsyncValue.data([...current, farm]);
    }

    return farm;
  }

  Future<Farm?> verifyFarm(
    String farmId, {
    required double latitude,
    required double longitude,
    String? documentUrl,
  }) async {
    final response = await _service.verifyFarm(
      farmId,
      latitude: latitude,
      longitude: longitude,
      documentUrl: documentUrl,
    );

    return response.fold(
      (error, statusCode) => null,
      (data, isFromCache) => data,
    );
  }

  void clear() {
    state = const AsyncValue.data([]);
  }
}

/// Crops Notifier
class CropsNotifier extends StateNotifier<AsyncValue<List<CropMarketData>>> {
  CropsNotifier() : super(const AsyncValue.data([]));

  final _service = agricultureService;

  Future<void> loadCrops() async {
    state = const AsyncValue.loading();
    final response = await _service.listCrops();
    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  Future<CropMarketData?> getCropDetails(String cropType) async {
    final response = await _service.getCropDetails(cropType);
    return response.fold(
      (error, statusCode) => null,
      (data, isFromCache) => data,
    );
  }

  void clear() {
    state = const AsyncValue.data([]);
  }
}

/// Transactions Notifier
class TransactionsNotifier extends StateNotifier<AsyncValue<List<Transaction>>> {
  TransactionsNotifier() : super(const AsyncValue.data([]));

  final _service = agricultureService;
  String? _currentFarmerId;

  Future<void> loadTransactionHistory(String farmerId, {int limit = 50}) async {
    _currentFarmerId = farmerId;
    state = const AsyncValue.loading();
    final response = await _service.getTransactionHistory(farmerId, limit: limit);
    state = response.fold(
      (error, statusCode) => AsyncValue.error(error, StackTrace.current),
      (data, isFromCache) => AsyncValue.data(data),
    );
  }

  void clear() {
    _currentFarmerId = null;
    state = const AsyncValue.data([]);
  }
}

// ==================== RIVERPOD PROVIDERS ====================

final farmerProfileProvider = StateNotifierProvider<FarmerProfileNotifier, AsyncValue<FarmerProfile?>>((ref) {
  return FarmerProfileNotifier();
});

final agriculturalLoansProvider = StateNotifierProvider<AgriculturalLoansNotifier, AsyncValue<List<AgriculturalLoan>>>((ref) {
  return AgriculturalLoansNotifier();
});

final cooperativesProvider = StateNotifierProvider<CooperativesNotifier, AsyncValue<List<CooperativeSavings>>>((ref) {
  return CooperativesNotifier();
});

final marketplaceProvider = StateNotifierProvider<MarketplaceNotifier, AsyncValue<List<MarketplaceListing>>>((ref) {
  return MarketplaceNotifier();
});

final farmsProvider = StateNotifierProvider<FarmsNotifier, AsyncValue<List<Farm>>>((ref) {
  return FarmsNotifier();
});

final cropsProvider = StateNotifierProvider<CropsNotifier, AsyncValue<List<CropMarketData>>>((ref) {
  return CropsNotifier();
});

final transactionsProvider = StateNotifierProvider<TransactionsNotifier, AsyncValue<List<Transaction>>>((ref) {
  return TransactionsNotifier();
});

// Selector providers for derived state

final farmerFullNameProvider = Provider((ref) {
  final farmer = ref.watch(farmerProfileProvider).value;
  return farmer?.fullName ?? '';
});

final isKycVerifiedProvider = Provider((ref) {
  final farmer = ref.watch(farmerProfileProvider).value;
  return farmer?.isFullyVerified ?? false;
});

final farmerLoansCountProvider = Provider((ref) {
  final loans = ref.watch(agriculturalLoansProvider).value ?? [];
  return loans.length;
});

final activeLoanProvider = Provider((ref) {
  final loans = ref.watch(agriculturalLoansProvider).value ?? [];
  return loans.where((l) => l.status == LoanStatus.disbursed || l.status == LoanStatus.repaying).toList();
});

final cooperativeMemberCountProvider = Provider((ref) {
  final coops = ref.watch(cooperativesProvider).value ?? [];
  return coops.isEmpty ? 0 : coops[0].memberCount;
});

final totalCooperativeSavingsProvider = Provider((ref) {
  final coops = ref.watch(cooperativesProvider).value ?? [];
  return coops.fold<double>(0, (sum, coop) => sum + coop.totalSavings);
});

final activeMarketplaceListingsProvider = Provider((ref) {
  final listings = ref.watch(marketplaceProvider).value ?? [];
  return listings.where((l) => l.listingStatus == 'active').toList();
});

final averageCropPriceProvider = Provider((ref) {
  final crops = ref.watch(cropsProvider).value ?? [];
  if (crops.isEmpty) return 0.0;
  final total = crops.fold<double>(0, (sum, crop) => sum + crop.marketPricePerTonne);
  return total / crops.length;
});

final recentTransactionsProvider = Provider((ref) {
  final transactions = ref.watch(transactionsProvider).value ?? [];
  return transactions.take(10).toList();
});

// ==================== COMBINED PROVIDERS ====================

final farmerDashboardProvider = FutureProvider<FarmerDashboard?>((ref) async {
  final farmerAsync = ref.watch(farmerProfileProvider);
  final loansAsync = ref.watch(agriculturalLoansProvider);
  final coopsAsync = ref.watch(cooperativesProvider);
  final transactionsAsync = ref.watch(transactionsProvider);

  return farmerAsync.when(
    data: (farmer) {
      if (farmer == null) return null;
      return FarmerDashboard(
        farmer: farmer,
        loans: loansAsync.value ?? [],
        cooperatives: coopsAsync.value ?? [],
        recentTransactions: transactionsAsync.value ?? [],
      );
    },
    loading: () => null,
    error: (err, stack) => null,
  );
});

/// ==================== DASHBOARD MODEL ====================

class FarmerDashboard {
  final FarmerProfile farmer;
  final List<AgriculturalLoan> loans;
  final List<CooperativeSavings> cooperatives;
  final List<Transaction> recentTransactions;

  FarmerDashboard({
    required this.farmer,
    required this.loans,
    required this.cooperatives,
    required this.recentTransactions,
  });

  double get totalLoanBalance => loans.fold(0, (sum, loan) => sum + (loan.outstandingBalance ?? 0));

  int get activeLoanCount => loans.where((l) => l.status == LoanStatus.disbursed).length;

  double get cooperativeSavings => cooperatives.fold(0, (sum, coop) => sum + coop.totalSavings);

  int get cooperativeCount => cooperatives.length;
}
