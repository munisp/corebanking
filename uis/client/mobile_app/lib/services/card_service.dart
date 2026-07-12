import 'api_service.dart';
import '../config/app_config.dart';

class CardService {
  final ApiService _apiService;

  CardService(this._apiService);

  // Issue a new card
  Future<Map<String, dynamic>> issueCard({
    required String cardType,
    required String accountId,
    required String nameOnCard,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.cardEndpoint}/issue',
        data: {
          'card_type': cardType,
          'account_id': accountId,
          'name_on_card': nameOnCard,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Card issued successfully',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Card issuance failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Get customer cards
  Future<Map<String, dynamic>> getCustomerCards() async {
    try {
      final response = await _apiService.get(
        '${AppConfig.cardEndpoint}/customer',
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        // Response structure: { "customer_id": "...", "cards": [...], "total": 1 }
        return {
          'success': true,
          'data': response.data['cards'] ?? [],
          'total': response.data['total'] ?? 0,
          'customer_id': response.data['customer_id'],
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to fetch cards',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Set card PIN
  Future<Map<String, dynamic>> setCardPin({
    required String cardId,
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.cardEndpoint}/$cardId/set-pin',
        data: {
          'pin': pin,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'PIN set successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to set PIN',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Block card
  Future<Map<String, dynamic>> blockCard(String cardId) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.cardEndpoint}/$cardId/block',
        data: {},
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Card blocked successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to block card',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Unblock card
  Future<Map<String, dynamic>> unblockCard(String cardId) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.cardEndpoint}/$cardId/unblock',
        data: {},
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Card unblocked successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to unblock card',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Freeze card
  Future<Map<String, dynamic>> freezeCard(String cardId) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.cardEndpoint}/$cardId/freeze',
        data: {},
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Card frozen successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to freeze card',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Unfreeze card
  Future<Map<String, dynamic>> unfreezeCard(String cardId) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.cardEndpoint}/$cardId/unfreeze',
        data: {},
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Card unfrozen successfully',
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to unfreeze card',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }

  // Get card health status
  Future<Map<String, dynamic>> getCardHealth() async {
    try {
      final response = await _apiService.get(
        '${AppConfig.cardEndpoint}/health',
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'data': response.data,
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Failed to fetch card health',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Error: ${e.toString()}',
      };
    }
  }
}
