import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../models/education_loan_application.dart';
import '../models/error_response.dart';
import '../services/education_loan_service.dart';

enum EducationLoanStatus { initial, loading, loaded, error }

class EducationLoanProvider extends ChangeNotifier {
      Future<Map<String, dynamic>> updateApplication(String id, Map<String, dynamic> data) async {
        try {
          final response = await _service.updateApplicationById(id, data);
          if (response.statusCode == 200 || response.statusCode == 201) {
            await fetchApplications();
            return {'success': true};
          }
          return {'success': false, 'message': 'Failed to update application'};
        } on DioException catch (e) {
          if (e.response?.data != null) {
            try {
              final errorResponse = ErrorResponse.fromJson(e.response!.data);
              return {'success': false, 'error': errorResponse};
            } catch (_) {
              return {'success': false, 'message': e.message ?? 'Failed to update application'};
            }
          }
          return {'success': false, 'message': e.message ?? 'Network error'};
        } catch (e) {
          return {'success': false, 'message': e.toString()};
        }
      }

      Future<Map<String, dynamic>> submitApplication(String id, {Map<String, dynamic>? data}) async {
        try {
          final response = await _service.submitApplication(id, data: data);
          if (response.statusCode == 200 || response.statusCode == 201) {
            await fetchApplications();
            return {'success': true};
          }
          return {'success': false, 'message': 'Failed to submit application'};
        } on DioException catch (e) {
          if (e.response?.data != null) {
            try {
              final errorResponse = ErrorResponse.fromJson(e.response!.data);
              return {'success': false, 'error': errorResponse};
            } catch (_) {
              return {'success': false, 'message': e.message ?? 'Failed to submit application'};
            }
          }
          return {'success': false, 'message': e.message ?? 'Network error'};
        } catch (e) {
          return {'success': false, 'message': e.toString()};
        }
      }
    Future<bool> acceptOffer(String id) async {
      try {
        final response = await _service.acceptOffer(id);
        if (response.statusCode == 200) {
          await fetchApplications();
          return true;
        }
      } catch (_) {}
      return false;
    }

    Future<bool> rejectOffer(String id) async {
      try {
        final response = await _service.rejectOffer(id);
        if (response.statusCode == 200) {
          await fetchApplications();
          return true;
        }
      } catch (_) {}
      return false;
    }
  final EducationLoanService _service = EducationLoanService();
  List<EducationLoanApplication> applications = [];
  EducationLoanStatus status = EducationLoanStatus.initial;
  String? errorMessage;

  Future<void> fetchApplications() async {
    status = EducationLoanStatus.loading;
    notifyListeners();
    try {
      final response = await _service.getApplications();
      if (response.statusCode == 200) {
        final List<dynamic> data = List.from(response.data is List ? response.data : ( response.data['applications'] ?? []));
        applications = data.map((e) => EducationLoanApplication.fromJson(e)).toList();
        status = EducationLoanStatus.loaded;
      } else {
        errorMessage = 'Failed to load applications';
        status = EducationLoanStatus.error;
      }
    } catch (e) {
      errorMessage = e.toString();
      status = EducationLoanStatus.error;
    }
    notifyListeners();
  }

  // Add more methods for apply, update, submit, accept/reject as needed
}
