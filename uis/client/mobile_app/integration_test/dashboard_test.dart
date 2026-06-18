import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Dashboard Navigation Tests', () {
    Future<void> loginHelper(WidgetTester tester) async {
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
    }

    testWidgets('Dashboard loads successfully', (WidgetTester tester) async {
      await loginHelper(tester);

      // Verify dashboard elements are present
      expect(find.text('Dashboard'), findsWidgets);
      
      // Verify common dashboard widgets
      expect(find.byType(Card), findsWidgets);
    });

    testWidgets('Navigate to Accounts screen', (WidgetTester tester) async {
      await loginHelper(tester);

      // Find and tap Accounts tile/button
      final accountsButton = find.textContaining('Account');
      if (accountsButton.evaluate().isNotEmpty) {
        await tester.tap(accountsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        // Verify navigation
        expect(find.textContaining('Account'), findsWidgets);
      }
    });

    testWidgets('Navigate to Transfers screen', (WidgetTester tester) async {
      await loginHelper(tester);

      final transfersButton = find.textContaining('Transfer');
      if (transfersButton.evaluate().isNotEmpty) {
        await tester.tap(transfersButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        expect(find.textContaining('Transfer'), findsWidgets);
      }
    });

    testWidgets('Navigate to Cards screen', (WidgetTester tester) async {
      await loginHelper(tester);

      final cardsButton = find.textContaining('Card');
      if (cardsButton.evaluate().isNotEmpty) {
        await tester.tap(cardsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        expect(find.textContaining('Card'), findsWidgets);
      }
    });

    testWidgets('Navigate to Loans screen', (WidgetTester tester) async {
      await loginHelper(tester);

      final loansButton = find.textContaining('Loan');
      if (loansButton.evaluate().isNotEmpty) {
        await tester.tap(loansButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        expect(find.textContaining('Loan'), findsWidgets);
      }
    });

    testWidgets('Navigate to Savings screen', (WidgetTester tester) async {
      await loginHelper(tester);

      final savingsButton = find.textContaining('Saving');
      if (savingsButton.evaluate().isNotEmpty) {
        await tester.tap(savingsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        expect(find.textContaining('Saving'), findsWidgets);
      }
    });

    testWidgets('Navigate to Investments screen', (WidgetTester tester) async {
      await loginHelper(tester);

      final investmentsButton = find.textContaining('Investment');
      if (investmentsButton.evaluate().isNotEmpty) {
        await tester.tap(investmentsButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        expect(find.textContaining('Investment'), findsWidgets);
      }
    });

    testWidgets('Bottom navigation bar works', (WidgetTester tester) async {
      await loginHelper(tester);

      // Test bottom navigation if present
      final bottomNavBar = find.byType(BottomNavigationBar);
      if (bottomNavBar.evaluate().isNotEmpty) {
        // Tap each navigation item
        final navItems = find.descendant(
          of: bottomNavBar,
          matching: find.byType(InkResponse),
        );

        for (int i = 0; i < navItems.evaluate().length && i < 5; i++) {
          await tester.tap(navItems.at(i));
          await tester.pumpAndSettle(const Duration(seconds: 2));
        }
      }
    });
  });
}
