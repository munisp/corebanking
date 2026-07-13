// ...existing code...
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../config/app_config.dart';
import 'api_service.dart';
import 'error_handler_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:universal_html/html.dart' as html;

class PaymentService {
  final ApiService _apiService;

  PaymentService(this._apiService);

  // =================== TRANSFER MONEY ===================
  /// Matches web app: ${AppConfig.paymentEndpoint}/payment/transfer
  /// Updated to use account numbers instead of account IDs
Future<Map<String, dynamic>> transfer({
  required String payerAccountNumber,
  required String payeeAccountNumber,
  required double amount,
  required String note,
  required String pin,
  String? bank,
  String currency = "NGN",
  String switchName = "mojaloop",
  String destination = "pup",
  String senderName = "Sender",
  String recipientName = "Recipient",
}) async {
  try {
    // Get account_number from storage
    String? accountNumber;

    if (kIsWeb) {
      try {
        final accountJson = html.window.localStorage['account'];

        if (accountJson != null && accountJson.isNotEmpty) {
          final accountData = jsonDecode(accountJson);
          accountNumber =
              accountData['account_number']?.toString();
        }
      } catch (_) {}
    } else {
      try {
        final prefs = await SharedPreferences.getInstance();

        final accountJson = prefs.getString('account');

        if (accountJson != null && accountJson.isNotEmpty) {
          final accountData = jsonDecode(accountJson);
          accountNumber =
              accountData['account_number']?.toString();
        }
      } catch (_) {}
    }

    // Use stored account number if available
    final payerNumber =
        accountNumber ?? payerAccountNumber;

    final Map<String, dynamic> transferData = {
  "payer": payerNumber,
  "payee": payeeAccountNumber,

  "amount": amount.toStringAsFixed(2),
  "currency": currency,
  "destination": destination,
  "note": note,
  "pin": pin,
  "switch_name": switchName,

  "from": {
    "idType": "ACCOUNT_ID",
    "idValue": payerNumber,
    "displayName": senderName,
  },

  "to": {
    "idType": "ACCOUNT_ID",
    "idValue": payeeAccountNumber,
    "displayName": recipientName,
  },
};

print(transferData);

    // Optional bank field
    if (bank != null && bank.isNotEmpty) {
      transferData["bank"] = bank;
    }

    final response = await _apiService.post(
      '${AppConfig.paymentHubEndpoint}/api/v1/transfers/initiate',
      data: transferData,
    );

    if (response.data['success'] == true ||
        response.statusCode == 200 ||
        response.statusCode == 201) {
      return {
        'success': true,
        'message':
            response.data['message'] ??
            'Transfer successful',
        'data': response.data,
      };
    } else {
      return {
        'success': false,
        'message':
            ErrorHandlerService.handleError(
              response.data,
            ),
      };
    }
  } catch (e) {
    return {
      'success': false,
      'message': ErrorHandlerService.handleError(e),
    };
  }
}

  // =================== INITIATE TRANSFER ===================
Future<Map<String, dynamic>> initiateTransfer({
  required String senderAccount,
  required String recipientAccount,
  required double amount,
  required String pin,
  String currency = "NGN",
  String note = "Transfer",
  String switchName = "mojaloop",
  String senderName = "Sender",
  String recipientName = "Recipient",
  String destination = "pup",
}) async {
  try {
    final response = await _apiService.post(
      '${AppConfig.paymentEndpoint}/payment/transfer',
      data: {
        "amount": amount.toStringAsFixed(2),
        "currency": currency,
        "destination": destination,
        "note": note,
        "pin": pin,
        "switch_name": switchName,
        "from": {
          "idType": "ACCOUNT_ID",
          "idValue": senderAccount,
          "displayName": senderName,
        },
        "to": {
          "idType": "ACCOUNT_ID",
          "idValue": recipientAccount,
          "displayName": recipientName,
        },
      },
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return response.data['data'] as Map<String, dynamic>;
    } else {
      throw Exception(
        ErrorHandlerService.handleError(response.data),
      );
    }
  } catch (e) {
    throw Exception(
      ErrorHandlerService.handleError(e),
    );
  }
}

  // Deposit money
  Future<Map<String, dynamic>> deposit({
    required String accountId,
    required double amount,
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/deposit',
        data: {
          'account_id': accountId,
          'amount': amount,
          'pin': pin,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Deposit successful',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  // Generate QR code for payment
  Future<Map<String, dynamic>> generateQR({
    required String recipient,
    required double amount,
    required String currency,
    String? note,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/qr/generate',
        data: {
          'recipient': recipient,
          'amount': amount.toString(), // API expects string
          'currency': currency,
          'note': note ?? '',
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'QR code generated',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  // Validate and process QR payment
  Future<Map<String, dynamic>> validateQR({
    required String recipient,
    required String amount,
    required String currency,
    String? note,
    required String expiry,
    required String signature,
    required String tenant,
    required int ledger,
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/qr/validate',
        data: {
          'recipient': recipient,
          'amount': amount,
          'currency': currency,
          'note': note ?? '',
          'expiry': expiry,
          'signature': signature,
          'tenant': tenant,
          'ledger': ledger,
          'pin': pin,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'QR payment successful',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  // Make loan payment
  // =================== MAKE LOAN PAYMENT ===================
Future<Map<String, dynamic>> loanPayment({
  required String loanId,
  required String customerAccountNumber, // ✅ CHANGED
  required double amount,
  required String pin,
}) async {
  try {
    print('Initiating loan payment with data:');
    print('Loan ID: $loanId');
    print('Customer Account Number: $customerAccountNumber'); // ✅ CHANGED
    print('Amount: $amount');
    final response = await _apiService.post(
      '${AppConfig.paymentEndpoint}/payment/loan',
      data: {
        'loan_id': loanId,
        'payer': customerAccountNumber, // ✅ USE ACCOUNT NUMBER
        'amount': amount,
        'pin': pin,
      },
    );

    if (response.data['success'] == true || response.statusCode == 200) {
      return {
        'success': true,
        'message': response.data['message'] ?? 'Loan payment successful',
        'data': response.data['data'],
      };
    }

    return {
      'success': false,
      'message': ErrorHandlerService.handleError(response.data),
    };
  } catch (e) {
    return {
      'success': false,
      'message': ErrorHandlerService.handleError(e),
    };
  }
}

  // Make LPO payment
 // =================== MAKE LPO PAYMENT ===================
Future<Map<String, dynamic>> lpoPayment({
  required String lpoId,
  required String customerAccountNumber,
  required double amount,
  required String pin,
}) async {
  try {
    final response = await _apiService.post(
      '${AppConfig.paymentEndpoint}/payment/lpo',
      data: {
        'lpo_id': lpoId,
        'payer': customerAccountNumber,
        'amount': amount,
        'pin': pin,
      },
    );

    if (response.data['success'] == true || response.statusCode == 200) {
      return {
        'success': true,
        'message': response.data['message'] ?? 'LPO payment successful',
        'data': response.data['data'],
      };
    }

    return {
      'success': false,
      'message': ErrorHandlerService.handleError(response.data),
    };
  } catch (e) {
    return {
      'success': false,
      'message': ErrorHandlerService.handleError(e),
    };
  }
}

  // Pay insurance premium
  Future<Map<String, dynamic>> insurancePremiumPayment({
    required String insurancePolicyId,
    required String payer,
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/payment/insurance-premium',
        data: {
          'insurance_policy_id': insurancePolicyId,
          'payer': payer,
          'pin': pin,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Insurance premium payment successful',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  // Supply chain financing payment
  Future<Map<String, dynamic>> supplyChainPayment({
    required String financingId,
    required String payer,
    required String pin,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/supply-chain-financing',
        data: {
          'financing_id': financingId,
          'payer': payer,
          'pin': pin,
        },
      );

      if (response.data['success'] == true || response.statusCode == 200) {
        return {
          'success': true,
          'message': response.data['message'] ?? 'Supply chain payment successful',
          'data': response.data['data'],
        };
      } else {
        return {
          'success': false,
          'message': ErrorHandlerService.handleError(response.data),
        };
      }
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    } catch (e) {
      // ...existing code...
      return {
        'success': false,
        'message': 'An error occurred. Please try again.',
      };
    }
  }

  // =================== VERIFY ACCOUNT ===================
  Future<Map<String, dynamic>> verifyAccount({
    required String accountNumber,
    String? bankCode,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/verify-account',
        data: {
          'account_number': accountNumber,
          'bank_code': bankCode,
        },
      );

      if (response.statusCode == 200) {
        return response.data['data'] as Map<String, dynamic>;
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== GET BANKS ===================
  /// Fetch banks from payment-processing endpoint
  Future<List<Map<String, dynamic>>> getBanks() async {
    try {
      final response = await _apiService.get('https://54link-dev.upi.dev/account/bank');

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['banks'];
        return data.map((bank) => Map<String, dynamic>.from(bank)).toList();
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      throw Exception(ErrorHandlerService.handleError(e));
    }
  }

  // =================== VALIDATE ACCOUNT NUMBER ===================
  /// Validate payee account number before transfer
  /// Returns account details if valid
  Future<Map<String, dynamic>> validateAccountNumber(String accountNumber) async {
    try {
      final response = await _apiService.get(
        'https://54link-dev.upi.dev/account/account/account-number/$accountNumber',
      );

      if (response.statusCode == 200 && response.data['message'] == 'success') {
        return {
          'success': true,
          'account': response.data['account'],
          'accountName': response.data['account']['name'],
          'accountNumber': response.data['account']['account_number'],
        };
      } else {
        return {
          'success': false,
          'message': response.data['message'] ?? 'Account not found',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': ErrorHandlerService.handleError(e),
      };
    }
  }

  // =================== GET BILLER CATEGORIES ===================
  Future<List<Map<String, dynamic>>> getBillerCategories() async {
    try {
      final response = await _apiService.get('${AppConfig.paymentEndpoint}/billers/categories');

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['data'];
        return data.map((category) => Map<String, dynamic>.from(category)).toList();
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== GET BILLERS BY CATEGORY ===================
  Future<List<Map<String, dynamic>>> getBillers(String categoryId) async {
    try {
      final response = await _apiService.get(
        '${AppConfig.paymentEndpoint}/billers',
        queryParameters: {'category_id': categoryId},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['data'];
        return data.map((biller) => Map<String, dynamic>.from(biller)).toList();
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== PAY BILL ===================
  Future<Map<String, dynamic>> payBill({
    required String billerId,
    required String customerId,
    required double amount,
    Map<String, dynamic>? additionalData,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/bills',
        data: {
          'biller_id': billerId,
          'customer_id': customerId,
          'amount': amount,
          ...?additionalData,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return response.data['data'];
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== VALIDATE CUSTOMER ===================
  Future<Map<String, dynamic>> validateCustomer({
    required String billerId,
    required String customerId,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/bills/validate',
        data: {
          'biller_id': billerId,
          'customer_id': customerId,
        },
      );

      if (response.statusCode == 200) {
        return response.data['data'];
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== GET BENEFICIARIES ===================
  Future<List<Map<String, dynamic>>> getBeneficiaries() async {
    try {
      final response = await _apiService.get('${AppConfig.paymentEndpoint}/beneficiaries');

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['data'];
        return data.map((beneficiary) => Map<String, dynamic>.from(beneficiary)).toList();
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== ADD BENEFICIARY ===================
  Future<Map<String, dynamic>> addBeneficiary({
    required String accountNumber,
    required String accountName,
    String? bankCode,
    String? bankName,
  }) async {
    try {
      final response = await _apiService.post(
      '${AppConfig.paymentEndpoint}/beneficiaries',
      data: {
        'account_number': accountNumber,
        'account_name': accountName,
        'bank_code': bankCode,
        'bank_name': bankName,
      },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return response.data['data'];
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== DELETE BENEFICIARY ===================
  Future<void> deleteBeneficiary(String beneficiaryId) async {
    try {
      final response = await _apiService.delete(
        '${AppConfig.paymentEndpoint}/beneficiaries/$beneficiaryId',
      );

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== PROCESS QR PAYMENT ===================
  Future<Map<String, dynamic>> processQRPayment({
    required String qrData,
    required double amount,
    String? narration,
  }) async {
    try {
      final response = await _apiService.post(
        '${AppConfig.paymentEndpoint}/qr-payment',
        data: {
          'qr_data': qrData,
          'amount': amount,
          'narration': narration,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return response.data['data'];
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }

  // =================== BULK PAYMENT ===================
  Future<Map<String, dynamic>> bulkPayment({
    String? batchId,
    required String pin,
    required List<Map<String, String>> transfers,
  }) async {
    // Resolve sender account number from storage
    String fromAccount = '';
    String fromName = 'Sender';
    try {
      if (kIsWeb) {
        final accountJson = html.window.localStorage['account'];
        if (accountJson != null && accountJson.isNotEmpty) {
          final accountData = jsonDecode(accountJson);
          fromAccount = accountData['account_number']?.toString() ?? '';
          fromName = accountData['name']?.toString() ?? 'Sender';
        }
      } else {
        final prefs = await SharedPreferences.getInstance();
        final accountJson = prefs.getString('account');
        if (accountJson != null && accountJson.isNotEmpty) {
          final accountData = jsonDecode(accountJson);
          fromAccount = accountData['account_number']?.toString() ?? '';
          fromName = accountData['name']?.toString() ?? 'Sender';
        }
      }
    } catch (_) {}

    final batchRef = batchId ?? DateTime.now().millisecondsSinceEpoch.toString();
    int succeeded = 0;
    int failed = 0;
    final List<Map<String, dynamic>> results = [];

    for (int i = 0; i < transfers.length; i++) {
      final t = transfers[i];
      try {
        final response = await _apiService.post(
          '${AppConfig.paymentHubEndpoint}/api/v1/transfers/initiate',
          data: {
            'amount': (double.tryParse(t['amount'] ?? '0') ?? 0).toStringAsFixed(2),
            'currency': 'NGN',
            'destination': AppConfig.CURRENT_TENANT_ID,
            'switch_name': 'mojaloop',
            'note': t['narration'] ?? 'Bulk Transfer',
            'pin': pin,
            'from': {
              'idType': 'ACCOUNT_ID',
              'idValue': fromAccount,
              'displayName': fromName,
            },
            'to': {
              'idType': 'ACCOUNT_ID',
              'idValue': t['accountNumber'] ?? '',
              'displayName': t['accountName'] ?? t['accountNumber'] ?? 'Recipient',
            },
          },
        );

        if (response.statusCode == 200 || response.statusCode == 201) {
          succeeded++;
          results.add({
            'index': i,
            'status': 'success',
            'transactionId': response.data['transactionId'] ?? response.data['id'],
          });
        } else {
          failed++;
          results.add({
            'index': i,
            'status': 'failed',
            'error': ErrorHandlerService.handleError(response.data),
          });
        }
      } catch (e) {
        failed++;
        results.add({
          'index': i,
          'status': 'failed',
          'error': ErrorHandlerService.handleError(e),
        });
      }
    }

    final total = transfers.length;
    final successRate = total > 0 ? (succeeded / total) * 100 : 0.0;

    return {
      'success': true,
      'message': 'Batch complete',
      'data': {
        'batch_id': batchRef,
        'total': total,
        'succeeded': succeeded,
        'failed': failed,
        'success_rate_pct': successRate,
        'results': results,
      },
    };
  }

  // =================== GET BULK PAYMENT HISTORY ===================
  Future<List<Map<String, dynamic>>> getBulkPaymentHistory({int page = 1, int limit = 20}) async {
    try {
      final response = await _apiService.get(
        '${AppConfig.baseUrl}/bulk-payments/v1/bulk-payments',
        queryParameters: {'page': page, 'limit': limit},
      );
      if (response.statusCode == 200) {
        final items = response.data['items'] as List<dynamic>? ?? [];
        return items.map((e) => Map<String, dynamic>.from(e)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // =================== GENERATE PERSONAL QR CODE ===================
  Future<String> generateQRCode() async {
    try {
      final response = await _apiService.get('${AppConfig.paymentEndpoint}/qr-code');

      if (response.statusCode == 200) {
        return response.data['data']['qr_code'];
      } else {
        throw Exception(ErrorHandlerService.handleError(response.data));
      }
    } catch (e) {
      // ...existing code...
      throw Exception(ErrorHandlerService.handleError(e));
    } catch (e) {
      // ...existing code...
      throw Exception('An error occurred. Please try again.');
    }
  }
}
