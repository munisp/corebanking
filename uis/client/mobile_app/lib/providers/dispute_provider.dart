import '../utils/text_case_utils.dart';
import 'package:flutter/foundation.dart';
import '../models/dispute.dart';
import '../services/dispute_service.dart';

class DisputeProvider with ChangeNotifier {
  final DisputeService _disputeService = DisputeService();

  List<Dispute> _disputesList = [];
  Dispute? _selectedDispute;
  List<Map<String, dynamic>> _comments = [];
  bool _isLoading = false;
  bool _isProcessing = false;
  bool _isLoadingComments = false;
  String? _errorMessage;

  List<Dispute> get disputesList => _disputesList;
  Dispute? get selectedDispute => _selectedDispute;
  List<Map<String, dynamic>> get comments => _comments;
  bool get isLoading => _isLoading;
  bool get isProcessing => _isProcessing;
  bool get isLoadingComments => _isLoadingComments;
  String? get errorMessage => _errorMessage;

  // Get disputes by status
  List<Dispute> getDisputesByStatus(String status) {
    return _disputesList.where((d) => toLowerCase(d.status) == toLowerCase(status)).toList();
  }

  // Get all disputes
  Future<void> fetchAllDisputes() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _disputesList = await _disputeService.getAllDisputes();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  // Get dispute by ID
  Future<void> fetchDisputeById(String id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _selectedDispute = await _disputeService.getDisputeById(id);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  // Create new dispute
  Future<bool> createDispute({
    required String transactionId,
    required String disputeType,
    required String description,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final newDispute = await _disputeService.createDispute(
        transactionId: transactionId,
        disputeType: disputeType,
        description: description,
      );
      
      _disputesList.insert(0, newDispute);
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

  // Update dispute
  Future<bool> updateDispute({
    required String id,
    String? subject,
    String? description,
    String? category,
    List<String>? attachments,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updatedDispute = await _disputeService.updateDispute(
        id: id,
        subject: subject,
        description: description,
        category: category,
        attachments: attachments,
      );
      
      final index = _disputesList.indexWhere((d) => d.id == id);
      if (index != -1) {
        _disputesList[index] = updatedDispute;
      }
      
      if (_selectedDispute?.id == id) {
        _selectedDispute = updatedDispute;
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

  // Add comment to dispute
  Future<bool> addComment({
    required String disputeId,
    required String comment,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _disputeService.addComment(
        disputeId: disputeId,
        comment: comment,
      );
      
      // Refresh comments
      await fetchDisputeComments(disputeId);
      
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

  // Get dispute comments
  Future<void> fetchDisputeComments(String disputeId) async {
    _isLoadingComments = true;
    notifyListeners();

    try {
      _comments = await _disputeService.getDisputeComments(disputeId);
      _isLoadingComments = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoadingComments = false;
      notifyListeners();
    }
  }

  // Cancel dispute
  Future<bool> cancelDispute(String id) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final cancelledDispute = await _disputeService.cancelDispute(id);
      
      final index = _disputesList.indexWhere((d) => d.id == id);
      if (index != -1) {
        _disputesList[index] = cancelledDispute;
      }
      
      if (_selectedDispute?.id == id) {
        _selectedDispute = cancelledDispute;
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

  // Escalate dispute
  Future<bool> escalateDispute(String id, {String? reason}) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final escalatedDispute = await _disputeService.escalateDispute(id, reason: reason);
      
      final index = _disputesList.indexWhere((d) => d.id == id);
      if (index != -1) {
        _disputesList[index] = escalatedDispute;
      }
      
      if (_selectedDispute?.id == id) {
        _selectedDispute = escalatedDispute;
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

  // Delete dispute
  Future<bool> deleteDispute(String id) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _disputeService.deleteDispute(id);
      _disputesList.removeWhere((d) => d.id == id);
      
      if (_selectedDispute?.id == id) {
        _selectedDispute = null;
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

  // Upload attachment
  Future<String?> uploadAttachment({
    required String disputeId,
    required String filePath,
  }) async {
    try {
      final url = await _disputeService.uploadAttachment(
        disputeId: disputeId,
        filePath: filePath,
      );
      return url;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return null;
    }
  }

  // Clear error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // Set selected dispute
  void setSelectedDispute(Dispute dispute) {
    _selectedDispute = dispute;
    notifyListeners();
  }

  // Clear selected dispute
  void clearSelectedDispute() {
    _selectedDispute = null;
    _comments = [];
    notifyListeners();
  }
}
