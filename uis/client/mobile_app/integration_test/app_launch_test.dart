import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;
import 'package:mobile_app/screens/splash_screen.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('App launches and shows splash screen', (WidgetTester tester) async {
    app.main();
    await tester.pumpAndSettle();
    expect(find.byType(SplashScreen), findsOneWidget);
  });
}
