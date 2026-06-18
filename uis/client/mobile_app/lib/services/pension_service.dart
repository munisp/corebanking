import 'api_service.dart';

const String _base = '/pension/v1/pension-py';

class PensionAccount {
  final String id;
  final String customerName;
  final String accountType;
  final String pfa;
  final String rsaNumber;
  final double totalContributions;
  final double employerContribution;
  final double employeeContribution;
  final String currency;
  final String status;
  final String? createdAt;

  const PensionAccount({
    required this.id,
    required this.customerName,
    required this.accountType,
    required this.pfa,
    required this.rsaNumber,
    required this.totalContributions,
    required this.employerContribution,
    required this.employeeContribution,
    required this.currency,
    required this.status,
    this.createdAt,
  });

  factory PensionAccount.fromJson(Map<String, dynamic> j) => PensionAccount(
        id: j['id']?.toString() ?? '',
        customerName: j['customer_name']?.toString() ?? '',
        accountType: j['account_type']?.toString() ?? 'individual',
        pfa: j['pfa']?.toString() ?? '',
        rsaNumber: j['rsa_number']?.toString() ?? '',
        totalContributions: (j['total_contributions'] as num?)?.toDouble() ?? 0,
        employerContribution: (j['employer_contribution'] as num?)?.toDouble() ?? 0,
        employeeContribution: (j['employee_contribution'] as num?)?.toDouble() ?? 0,
        currency: j['currency']?.toString() ?? 'NGN',
        status: j['status']?.toString() ?? 'active',
        createdAt: j['created_at']?.toString(),
      );
}

class PensionContribution {
  final String id;
  final String accountId;
  final String date;
  final double employer;
  final double employee;
  final double total;
  final String status;

  const PensionContribution({
    required this.id,
    required this.accountId,
    required this.date,
    required this.employer,
    required this.employee,
    required this.total,
    required this.status,
  });

  factory PensionContribution.fromJson(Map<String, dynamic> j) => PensionContribution(
        id: j['id']?.toString() ?? '',
        accountId: j['account_id']?.toString() ?? '',
        date: j['date']?.toString() ?? '',
        employer: (j['employer'] as num?)?.toDouble() ?? 0,
        employee: (j['employee'] as num?)?.toDouble() ?? 0,
        total: (j['total'] as num?)?.toDouble() ?? 0,
        status: j['status']?.toString() ?? 'posted',
      );
}

class PensionService {
  final ApiService _apiService;

  PensionService(this._apiService);

  Future<List<PensionAccount>> listAccounts() async {
    try {
      final response = await _apiService.get('$_base/pension_accounts');
      if (response.statusCode == 200) {
        final data = response.data;
        List<dynamic> items;
        if (data is List) {
          items = data;
        } else if (data is Map) {
          items = (data['pension_accounts'] ?? data['items'] ?? data['data'] ?? []) as List<dynamic>;
        } else {
          items = [];
        }
        return items
            .whereType<Map<String, dynamic>>()
            .map(PensionAccount.fromJson)
            .toList();
      }
      throw Exception(response.data is Map ? response.data['error'] ?? 'Failed to load accounts' : 'Failed to load accounts');
    } catch (e) {
      throw Exception('Failed to load pension accounts: $e');
    }
  }

  Future<Map<String, dynamic>> getStats() async {
    try {
      final response = await _apiService.get('$_base/stats');
      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(response.data as Map);
      }
      throw Exception('Failed to load stats');
    } catch (e) {
      throw Exception('Failed to load pension stats: $e');
    }
  }

  Future<List<PensionContribution>> getContributions(String accountId) async {
    try {
      final response = await _apiService.get('$_base/pension_accounts/$accountId/contributions');
      if (response.statusCode == 200) {
        final data = response.data;
        List<dynamic> items;
        if (data is List) {
          items = data;
        } else if (data is Map && data.containsKey('items')) {
          items = data['items'] as List<dynamic>;
        } else {
          items = [];
        }
        return items
            .whereType<Map<String, dynamic>>()
            .map(PensionContribution.fromJson)
            .toList();
      }
      throw Exception('Failed to load contributions');
    } catch (e) {
      throw Exception('Failed to load contributions: $e');
    }
  }

  Future<PensionAccount> createAccount(Map<String, dynamic> payload) async {
    try {
      final response = await _apiService.post('$_base/pension_accounts', data: payload);
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        final item = data['item'] ?? data;
        return PensionAccount.fromJson(Map<String, dynamic>.from(item as Map));
      }
      throw Exception(response.data is Map ? response.data['error'] ?? 'Failed to create account' : 'Failed to create account');
    } catch (e) {
      throw Exception('Failed to create pension account: $e');
    }
  }

  Future<PensionAccount> pause(String id) async {
    try {
      final response = await _apiService.post('$_base/pension_accounts/$id/pause', data: {});
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final item = data['item'] ?? data;
        return PensionAccount.fromJson(Map<String, dynamic>.from(item as Map));
      }
      throw Exception('Failed to pause account');
    } catch (e) {
      throw Exception('Failed to pause pension account: $e');
    }
  }

  Future<PensionAccount> resume(String id) async {
    try {
      final response = await _apiService.post('$_base/pension_accounts/$id/resume', data: {});
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final item = data['item'] ?? data;
        return PensionAccount.fromJson(Map<String, dynamic>.from(item as Map));
      }
      throw Exception('Failed to resume account');
    } catch (e) {
      throw Exception('Failed to resume pension account: $e');
    }
  }

  Future<PensionAccount> withdraw(String id) async {
    try {
      final response = await _apiService.post('$_base/pension_accounts/$id/withdraw', data: {});
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final item = data['item'] ?? data;
        return PensionAccount.fromJson(Map<String, dynamic>.from(item as Map));
      }
      throw Exception('Failed to withdraw account');
    } catch (e) {
      throw Exception('Failed to withdraw pension account: $e');
    }
  }
}
