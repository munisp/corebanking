import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Authentication Flow Tests', () {
    testWidgets('Complete login flow with valid credentials',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      // Should now be on login screen
      expect(find.byType(TextFormField), findsWidgets);

      // Enter email
      final emailFields = find.byType(TextFormField);
      await tester.enterText(emailFields.first, 'test10@gmail.com');
      await tester.pump();

      // Enter password
      await tester.enterText(emailFields.last, 'Test1234@');
      await tester.pump();

      // Find and tap login button (it's a GestureDetector with Container)
      final loginButton = find.text('Login');
      expect(loginButton, findsWidgets);
      await tester.tap(loginButton.last); // Use last to avoid conflict with nav items
      await tester.pump();

      // Wait for login to complete
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle(const Duration(seconds: 5));

      // Verify navigation to dashboard (check for bottom navigation)
      expect(
        find.byType(BottomNavigationBar),
        findsOneWidget,
      );
      
      // Or check for Home tab
      expect(
        find.text('Home'),
        findsWidgets,
      );
    });

    testWidgets('Login with invalid credentials shows error',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      // Should be on login screen
      final emailFields = find.byType(TextFormField);
      expect(emailFields, findsWidgets);

      // Enter invalid credentials
      await tester.enterText(emailFields.first, 'invalid@test.com');
      await tester.pump();

      await tester.enterText(emailFields.last, 'WrongPassword');
      await tester.pump();

      // Tap login button
      final loginButton = find.text('Login');
      await tester.tap(loginButton.last);
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      // Verify error message appears (could be in various formats)
      final hasError = find.textContaining('Invalid').evaluate().isNotEmpty ||
          find.textContaining('incorrect').evaluate().isNotEmpty ||
          find.textContaining('failed').evaluate().isNotEmpty;
      
      expect(hasError, isTrue);
    });

    testWidgets('Remember me checkbox works', (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      // Find and tap remember me checkbox if it exists
      final rememberMeCheckbox = find.byType(Checkbox);
      if (rememberMeCheckbox.evaluate().isNotEmpty) {
        final checkboxBefore = tester.widget<Checkbox>(rememberMeCheckbox);
        final valueBefore = checkboxBefore.value ?? false;
        
        await tester.tap(rememberMeCheckbox);
        await tester.pump();
        await tester.pumpAndSettle();

        // Verify checkbox toggled
        final checkboxAfter = tester.widget<Checkbox>(rememberMeCheckbox);
        expect(checkboxAfter.value, isNot(valueBefore));
      }
    });

    testWidgets('Navigate to forgot password screen',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      // Find and tap forgot password link
      final forgotPasswordLink = find.text('Forgot Password?');
      if (forgotPasswordLink.evaluate().isNotEmpty) {
        await tester.tap(forgotPasswordLink);
        await tester.pump();
        await tester.pumpAndSettle();

        // Verify navigation to forgot password screen
        expect(
          find.textContaining('Reset'),
          findsAny,
        );
      }
    });

    testWidgets('Navigate to register screen', (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      // Scroll down to make register button visible
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
      await tester.pumpAndSettle();

      // Find and tap register button (it's a TextButton)
      final registerButton = find.widgetWithText(TextButton, 'Register');
      if (registerButton.evaluate().isNotEmpty) {
        await tester.tap(registerButton);
        await tester.pump();
        await tester.pumpAndSettle();

        // Verify navigation to register screen
        expect(
          find.textContaining('Create'),
          findsAny,
        );
      }
    });
  });
}
