import 'package:flutter/foundation.dart';
import '../models/savings.dart';
import '../services/savings_service.dart';

class SavingsProvider with ChangeNotifier {
  late final SavingsService _savingsService;

  List<Savings> _savingsList = [];
  Savings? _selectedSavings;
  bool _isLoading = false;
  bool _isProcessing = false;
  String? _errorMessage;

  List<Savings> get savingsList => _savingsList;
  Savings? get selectedSavings => _selectedSavings;
  bool get isLoading => _isLoading;
  bool get isProcessing => _isProcessing;
  String? get errorMessage => _errorMessage;

  SavingsProvider(this._savingsService);

  // Get all savings
  Future<void> fetchAllSavings() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _savingsList = await _savingsService.getAllSavings();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  // Create new savings
  // Accepts: name, target_amount (int), target_date (DateTime), enable_auto_save (bool)
  Future<bool> createSavings({
    required String name,
    required int targetAmount,
    required DateTime targetDate,
    required bool enableAutoSave,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final newSavings = await _savingsService.createSavings(
        name: name,
        targetAmount: targetAmount,
        targetDate: targetDate,
        enableAutoSave: enableAutoSave,
      );
      
      _savingsList.insert(0, newSavings);
      _errorMessage = null; // Clear any previous error on success
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Update savings
  Future<bool> updateSavings({
    required String id,
    String? name,
    String? description,
    double? targetAmount,
    String? frequency,
    double? contributionAmount,
    DateTime? endDate,
    String? status,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updatedSavings = await _savingsService.updateSavings(
        id: id,
        name: name,
        description: description,
        targetAmount: targetAmount,
        frequency: frequency,
        contributionAmount: contributionAmount,
        endDate: endDate,
        status: status,
      );
      
      final index = _savingsList.indexWhere((s) => s.id == id);
      if (index != -1) {
        _savingsList[index] = updatedSavings;
      }
      
      if (_selectedSavings?.id == id) {
        _selectedSavings = updatedSavings;
      }
      
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Make contribution
  Future<bool> makeContribution({
    required String savingsId,
    required double amount,
    required String customerAccount,
    required String pin,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _savingsService.makeContribution(
        savingsId: savingsId,
        amount: amount,
        customerAccount: customerAccount,
        pin: pin,
      );
      
      // Refresh the entire savings list to get updated data
      await fetchAllSavings();
      
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Withdraw from savings
  Future<bool> withdrawFromSavings({
    required String savingsId,
    required double amount,
    String? reason,
    required String customerAccount,
    required String pin,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _savingsService.withdrawFromSavings(
        savingsId: savingsId,
        amount: amount,
        reason: reason,
        customerAccount: customerAccount,
        pin: pin,
      
      );
      
      // Refresh the entire savings list to get updated data
      await fetchAllSavings();
      
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Delete savings (matching web app: returns { success: boolean; message: string })
  Future<bool> deleteSavings(String id) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _savingsService.deleteSavings(id);
      
      if (result['success'] == true) {
        _savingsList.removeWhere((s) => s.id == id);
        
        if (_selectedSavings?.id == id) {
          _selectedSavings = null;
        }
        
        _isProcessing = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = result['message'] ?? 'Failed to delete savings';
        _isProcessing = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Pause savings (matching web app: uses POST to /{id}/pause)
  Future<bool> pauseSavings(String id) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updatedSavings = await _savingsService.pauseSavings(id);
      
      final index = _savingsList.indexWhere((s) => s.id == id);
      if (index != -1) {
        _savingsList[index] = updatedSavings;
      }
      
      if (_selectedSavings?.id == id) {
        _selectedSavings = updatedSavings;
      }
      
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Resume savings (matching web app: uses POST to /{id}/resume)
  Future<bool> resumeSavings(String id) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updatedSavings = await _savingsService.resumeSavings(id);
      
      final index = _savingsList.indexWhere((s) => s.id == id);
      if (index != -1) {
        _savingsList[index] = updatedSavings;
      }
      
      if (_selectedSavings?.id == id) {
        _selectedSavings = updatedSavings;
      }
      
      _isProcessing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }

  // Complete savings
  Future<bool> completeSavings(String id) async {
    return updateSavings(id: id, status: 'completed');
  }

  // Clear error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // Set selected savings
  void setSelectedSavings(Savings savings) {
    _selectedSavings = savings;
    notifyListeners();
  }

  // Clear selected savings
  void clearSelectedSavings() {
    _selectedSavings = null;
    notifyListeners();
  }
}
