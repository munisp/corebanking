import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'https://platform.54bank.app';
  String? _authToken;
  Duration timeout = const Duration(seconds: 10);

  void setAuthToken(String token) => _authToken = token;
  void clearAuthToken() => _authToken = null;
  bool get isAuthenticated => _authToken != null;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    if (_authToken != null) 'Authorization': 'Bearer $_authToken',
  };

  Future<Map<String, dynamic>> get(String path) async {
    final response = await http
        .get(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(timeout);
    if (response.statusCode != 200) throw ApiException(response.statusCode, response.body);
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final response = await http
        .post(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body))
        .timeout(timeout);
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw ApiException(response.statusCode, response.body);
    }
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final response = await http
        .put(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body))
        .timeout(timeout);
    if (response.statusCode != 200) throw ApiException(response.statusCode, response.body);
    return jsonDecode(response.body);
  }

  Future<void> delete(String path) async {
    final response = await http
        .delete(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(timeout);
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw ApiException(response.statusCode, response.body);
    }
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final response = await http
        .patch(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body))
        .timeout(timeout);
    if (response.statusCode != 200) throw ApiException(response.statusCode, response.body);
    return jsonDecode(response.body);
  }

  // === Core Banking ===
  Future<List<dynamic>> getCustomers() async => (await get('/api/customers'))['items'] ?? [];
  Future<Map<String, dynamic>> createCustomer(Map<String, dynamic> data) async => post('/api/customers', data);
  Future<Map<String, dynamic>> updateCustomer(String id, Map<String, dynamic> data) async => put('/api/customers/$id', data);
  Future<void> deleteCustomer(String id) async => delete('/api/customers/$id');

  // === Accounts ===
  Future<List<dynamic>> getAccounts() async => (await get('/api/accounts/v1/applications'))['items'] ?? [];
  Future<Map<String, dynamic>> getAccountStatement(String accountId) async => get('/api/accounts/v1/statements/$accountId');
  Future<List<dynamic>> getFixedDeposits() async => (await get('/api/deposits/v1/fixed'))['items'] ?? [];
  Future<List<dynamic>> getSavingsProducts() async => (await get('/api/products/v1/savings'))['items'] ?? [];

  // === Payments ===
  Future<List<dynamic>> getPayments() async => (await get('/api/payments/v1/transactions'))['items'] ?? [];
  Future<Map<String, dynamic>> createPayment(Map<String, dynamic> data) async => post('/api/payments/v1/transactions', data);
  Future<List<dynamic>> getBulkPayments() async => (await get('/api/payments/v1/bulk'))['items'] ?? [];
  Future<List<dynamic>> getTransfers(String customerId) async => (await get('/api/customers/$customerId/transfers'))['items'] ?? [];
  Future<Map<String, dynamic>> createTransfer(Map<String, dynamic> data) async => post('/api/transfers', data);

  // === Cards ===
  Future<List<dynamic>> getCards(String customerId) async => (await get('/api/customers/$customerId/cards'))['items'] ?? [];
  Future<List<dynamic>> getAllCards() async => (await get('/api/cards/v1/inventory'))['items'] ?? [];
  Future<List<dynamic>> getCardFraudRules() async => (await get('/api/cards/v1/fraud-rules'))['items'] ?? [];

  // === Lending ===
  Future<List<dynamic>> getLoanApplications() async => (await get('/api/loans/v1/applications'))['items'] ?? [];
  Future<Map<String, dynamic>> createLoanApplication(Map<String, dynamic> data) async => post('/api/loans/v1/applications', data);
  Future<List<dynamic>> getLoanProducts() async => (await get('/api/loans/v1/products'))['items'] ?? [];
  Future<List<dynamic>> getLoanAccounts() async => (await get('/api/loans/v1/accounts'))['items'] ?? [];
  Future<List<dynamic>> getMortgages() async => (await get('/api/mortgage/v1/applications'))['items'] ?? [];
  Future<List<dynamic>> getEducationLoans() async => (await get('/api/education-loans/v1/loans'))['items'] ?? [];

  // === Treasury ===
  Future<Map<String, dynamic>> getTreasuryPositions() async => get('/api/treasury/v1/positions');
  Future<List<dynamic>> getFxRates() async => (await get('/api/fx/v1/rates'))['items'] ?? [];
  Future<List<dynamic>> getFxDeals() async => (await get('/api/fx/v1/deals'))['items'] ?? [];
  Future<List<dynamic>> getMoneyMarket() async => (await get('/api/treasury/v1/money-market'))['items'] ?? [];
  Future<Map<String, dynamic>> getLiquidity() async => get('/api/treasury/v1/liquidity');

  // === Trade Finance ===
  Future<List<dynamic>> getTradeInstruments() async => (await get('/api/trade/v1/instruments'))['items'] ?? [];
  Future<List<dynamic>> getBankGuarantees() async => (await get('/api/trade/v1/guarantees'))['items'] ?? [];
  Future<List<dynamic>> getCorrespondentBanks() async => (await get('/api/correspondent/v1/banks'))['items'] ?? [];

  // === Wealth ===
  Future<List<dynamic>> getPortfolios() async => (await get('/api/wealth/v1/portfolios'))['items'] ?? [];
  Future<List<dynamic>> getSecuritiesOrders() async => (await get('/api/securities/v1/orders'))['items'] ?? [];

  // === GL / Accounting ===
  Future<List<dynamic>> getChartOfAccounts() async => (await get('/api/gl/v1/chart-of-accounts'))['items'] ?? [];
  Future<List<dynamic>> getGLAccounts() async => (await get('/api/gl/v1/accounts'))['items'] ?? [];
  Future<List<dynamic>> getJournalEntries() async => (await get('/api/gl/v1/journals'))['items'] ?? [];
  Future<List<dynamic>> getFeeSchedules() async => (await get('/api/fees/v1/schedules'))['items'] ?? [];

  // === Compliance ===
  Future<List<dynamic>> getKycScreening() async => (await get('/api/kyc/v1/screening'))['items'] ?? [];
  Future<List<dynamic>> getFraudAlerts() async => (await get('/api/fraud/v1/alerts'))['items'] ?? [];
  Future<List<dynamic>> getComplianceChecks() async => (await get('/api/compliance/v1/checks'))['items'] ?? [];
  Future<List<dynamic>> getRegulatoryReturns() async => (await get('/api/regulatory/v1/returns'))['items'] ?? [];
  Future<List<dynamic>> getDisputes() async => (await get('/api/disputes/v1/cases'))['items'] ?? [];

  // === KYC / Identity ===
  Future<List<dynamic>> getKycVerifications() async => (await get('/api/kyc/v1/verifications'))['items'] ?? [];
  Future<List<dynamic>> getKybVerifications() async => (await get('/api/kyb/v1/verifications'))['items'] ?? [];

  // === Agent & Specialty ===
  Future<List<dynamic>> getAgents() async => (await get('/api/agent/v1/agents'))['items'] ?? [];
  Future<List<dynamic>> getIslamicProducts() async => (await get('/api/islamic/v1/products'))['items'] ?? [];
  Future<List<dynamic>> getMicrofinanceGroups() async => (await get('/api/microfinance/v1/groups'))['items'] ?? [];
  Future<List<dynamic>> getEsusuGroups() async => (await get('/api/esusu/v1/groups'))['items'] ?? [];

  // === Platform ===
  Future<Map<String, dynamic>> getOverview() async => get('/api/platform/overview');
  Future<List<dynamic>> getServiceHealth() async => (await get('/api/platform/services'))['items'] ?? [];
  Future<List<dynamic>> getFeatureFlags() async => (await get('/api/feature-flags/v1/flags'))['items'] ?? [];
  Future<List<dynamic>> getAuditTrail() async => (await get('/api/audit-trail/v1/events'))['items'] ?? [];

  // === Infrastructure ===
  Future<List<dynamic>> getKafkaTopics() async => (await get('/api/kafka/v1/topics'))['items'] ?? [];
  Future<List<dynamic>> getTigerBeetleAccounts() async => (await get('/api/tigerbeetle/v1/accounts'))['items'] ?? [];

  // === Innovation ===
  Future<List<dynamic>> getOpenBankingTpps() async => (await get('/api/open-banking/v1/tpps'))['items'] ?? [];
  Future<List<dynamic>> getEnairaWallets() async => (await get('/api/enaira/v1/wallets'))['items'] ?? [];
  Future<List<dynamic>> getEsgScores() async => (await get('/api/esg/v1/scores'))['items'] ?? [];
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => 'ApiException($statusCode): $message';
}
