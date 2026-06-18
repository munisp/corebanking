import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;
import 'package:mobile_app/screens/auth/login_screen.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Login screen navigation', (WidgetTester tester) async {
    app.main();
    await tester.pumpAndSettle();
    // Tap on the login button from splash or onboarding
    final loginButton = find.text('Login');
    if (loginButton.evaluate().isNotEmpty) {
      await tester.tap(loginButton);
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
    } else {
      // If already on login screen
      expect(find.byType(LoginScreen), findsOneWidget);
    }
  });
}
