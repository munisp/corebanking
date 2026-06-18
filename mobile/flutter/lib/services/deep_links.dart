// 54Bank Deep Link Handler
// Routes: 54bank://transfer, 54bank://transaction/:id, 54bank://kyc, etc.

class DeepLinkService {
  static final DeepLinkService _instance = DeepLinkService._internal();
  factory DeepLinkService() => _instance;
  DeepLinkService._internal();

  static const String scheme = '54bank';
  static const String host = 'app.54bank.ng';

  // Supported deep link routes
  static const Map<String, String> routes = {
    '/transfer': '/screens/transfer',
    '/transaction': '/screens/transaction_detail',
    '/kyc': '/screens/kyc_verification',
    '/accounts': '/screens/accounts',
    '/loans': '/screens/loans',
    '/cards': '/screens/cards',
    '/bills': '/screens/bill_payment',
    '/profile': '/screens/profile',
    '/notifications': '/screens/notifications',
    '/approval': '/screens/approval_detail',
    '/statement': '/screens/account_statement',
    '/beneficiaries': '/screens/beneficiaries',
  };

  void handleDeepLink(Uri uri) {
    final path = uri.path;
    final queryParams = uri.queryParameters;

    if (routes.containsKey(path)) {
      // Navigate to the mapped screen with parameters
      navigateTo(routes[path]!, arguments: queryParams);
    } else {
      // Fallback to home
      navigateTo('/screens/dashboard');
    }
  }

  void navigateTo(String route, {Map<String, String>? arguments}) {
    // Use Navigator or GoRouter to navigate
    // Navigator.pushNamed(context, route, arguments: arguments);
  }

  // Generate shareable links
  static String generateTransferLink({String? accountNumber, int? amount}) {
    final params = <String, String>{};
    if (accountNumber != null) params['account'] = accountNumber;
    if (amount != null) params['amount'] = amount.toString();
    return Uri(scheme: 'https', host: host, path: '/transfer', queryParameters: params).toString();
  }

  static String generateTransactionLink(String transactionId) {
    return Uri(scheme: 'https', host: host, path: '/transaction/$transactionId').toString();
  }
}
